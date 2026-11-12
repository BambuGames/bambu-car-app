-- Processing (design 7, 9, 11.2–11.3): per-photo status and results written by the image worker, the
-- background library, gallery branding, and start_processing, which charges a vehicle once and queues
-- its photos. The photo row is the job record; a photo stuck for 10 minutes can be queued again.

create type public.photo_process_status as enum ('unprocessed', 'queued', 'processing', 'done', 'failed');
-- auto: placed by detection, waits for the quick check (M0 decision); needs_check: not found where a plate
-- should be; confirmed: checked or moved by staff; none: no plate in this photo.
create type public.plate_status as enum ('auto', 'needs_check', 'confirmed', 'none');

-- Backgrounds: platform rows (gallery_id null) or a gallery's own. spec is
-- {"kind":"studio","wall":"#RRGGBB","floor":"#RRGGBB"} (drawn by the worker) or {"kind":"image","path":"…"}
-- (a file in the backgrounds bucket, rendered with the template camera: 1 m high, 69°).
create table public.backgrounds (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid references public.galleries on delete cascade,
  name text not null,
  spec jsonb not null,
  sort_order int not null default 0
);
alter table public.backgrounds enable row level security;
create policy "signed-in users read platform and own backgrounds" on public.backgrounds
  for select to authenticated using (gallery_id is null or private.is_gallery_member(gallery_id));
insert into public.backgrounds (id, name, spec, sort_order) values
  ('b0000000-0000-0000-0000-000000000001', 'Studio Weiß', '{"kind":"studio","wall":"#FFFFFF","floor":"#F2F2F2"}', 1),
  ('b0000000-0000-0000-0000-000000000002', 'Studio Hellgrau', '{"kind":"studio","wall":"#E9EAEC","floor":"#DCDDE0"}', 2),
  ('b0000000-0000-0000-0000-000000000003', 'Studio Dunkel', '{"kind":"studio","wall":"#2B2D31","floor":"#1E1F22"}', 3);

-- Gallery branding. watermark: {position: top_left|top_right|bottom_left|bottom_right|center,
-- width: 0.05–0.4 of the output width, opacity: 0–1, band: null | {edge: top|bottom, color: "#RRGGBB",
-- height: 0.04–0.15}}; the worker fills in defaults.
alter table public.galleries
  add column logo_path text,
  add column banner_path text,
  add column watermark jsonb not null default '{}',
  add column default_background_id uuid references public.backgrounds,
  -- The worker reads these with the service role: they must stay in the gallery's own folder.
  add constraint galleries_logo_in_folder check (logo_path is null or (logo_path like id::text || '/%' and position('..' in logo_path) = 0)),
  add constraint galleries_banner_in_folder check (banner_path is null or (banner_path like id::text || '/%' and position('..' in banner_path) = 0));

alter table public.vehicles
  add column background_id uuid references public.backgrounds,
  add column tone_enabled boolean not null default true,
  add column credit_charged_at timestamptz,
  -- New originals ever uploaded (re-shoots included), for the per-vehicle cap of design 9.
  add column originals_count int not null default 0;

-- placement: {"m": [[a,b,c],[d,e,f]], "src": [w,h]} maps upright-original pixels to the 2560×1920 output
-- (horizon correction included). plate_corners and mask_edits are 0–1 in the upright original.
alter table public.photos
  add column process_status public.photo_process_status not null default 'unprocessed',
  add column process_error text,
  add column processed_at timestamptz,
  add column mask_path text,
  add column output_path text,
  add column output_wm_path text,
  add column placement jsonb,
  add column plate_corners jsonb,
  add column plate_status public.plate_status,
  add column mask_edits jsonb not null default '[]',
  add column tone_stats jsonb,
  -- The app writes {gallery}/{vehicle}/{slot}.jpg; the worker downloads it with the service role.
  add constraint photos_original_in_vehicle_folder check (
    original_path like gallery_id::text || '/' || vehicle_id::text || '/%' and position('..' in original_path) = 0);

-- A new original (re-shot) starts over: nothing processed for the old one applies to it. The app re-shoots
-- onto the same path ({gallery}/{vehicle}/{slot}.jpg), so a new captured_at is what marks a new original;
-- a retried upload of the same photo keeps its captured_at and its results.
create function private.reset_processing() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.original_path is distinct from old.original_path or new.captured_at is distinct from old.captured_at then
    new.process_status := 'unprocessed';
    new.process_error := null;
    new.processed_at := null;
    new.mask_path := null;
    new.output_path := null;
    new.output_wm_path := null;
    new.placement := null;
    new.plate_corners := null;
    new.plate_status := null;
    new.mask_edits := '[]';
    new.tone_stats := null;
  end if;
  return new;
end
$$;
create trigger photos_reset_processing before update on public.photos
  for each row execute function private.reset_processing();

-- Counts new originals per vehicle. Security definer: members cannot write vehicles.originals_count.
create function private.count_original() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.vehicles set originals_count = originals_count + 1 where id = new.vehicle_id;
  return null;
end
$$;
create trigger photos_count_new after insert on public.photos
  for each row execute function private.count_original();
create trigger photos_count_reshot after update on public.photos
  for each row when (new.original_path is distinct from old.original_path or new.captured_at is distinct from old.captured_at)
  execute function private.count_original();

-- A vehicle or gallery may use a platform background or one of its own gallery, never another gallery's.
-- Security definer: the row check must see backgrounds the caller's policy hides.
create function private.check_background() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_background uuid;
  v_gallery uuid;
begin
  if tg_table_name = 'vehicles' then
    v_background := new.background_id;
    v_gallery := new.gallery_id;
  else
    v_background := new.default_background_id;
    v_gallery := new.id;
  end if;
  if v_background is not null and exists (
    select 1 from public.backgrounds b where b.id = v_background and b.gallery_id is not null and b.gallery_id <> v_gallery
  ) then
    raise exception 'background_not_allowed' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger vehicles_check_background before insert or update of background_id, gallery_id on public.vehicles
  for each row execute function private.check_background();
create trigger galleries_check_background before insert or update of default_background_id on public.galleries
  for each row execute function private.check_background();

-- The app pushes its whole vehicle row, status included; its draft/shooting must not undo the server's
-- processing/ready. Archiving stays the user's.
create function private.keep_server_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status in ('processing', 'ready') and new.status in ('draft', 'shooting') then
    new.status := old.status;
  end if;
  return new;
end
$$;
create trigger vehicles_keep_server_status before update on public.vehicles
  for each row execute function private.keep_server_status();

-- Members write what the app sends (and, from M2b, touch-up edits and plate decisions); processing
-- results and the charge are written only by the service role and start_processing.
revoke insert, update on public.photos from anon, authenticated;
grant insert (id, vehicle_id, gallery_id, slot, original_path, captured_at, capture, qc, mask_edits, plate_corners, plate_status),
  update (id, vehicle_id, gallery_id, slot, original_path, captured_at, capture, qc, mask_edits, plate_corners, plate_status)
  on public.photos to authenticated;
revoke insert, update on public.vehicles from anon, authenticated;
grant insert (id, gallery_id, make, model, body_type, status, details, created_at, updated_at, background_id, tone_enabled),
  update (id, gallery_id, make, model, body_type, status, details, created_at, updated_at, background_id, tone_enabled)
  on public.vehicles to authenticated;

-- Storage: processed results (worker only writes), gallery branding (owners write), backgrounds.
insert into storage.buckets (id, name, public) values
  ('processed', 'processed', false),
  ('branding', 'branding', false),
  ('backgrounds', 'backgrounds', false);

create function private.is_gallery_owner_folder(folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gallery_members m
    where m.gallery_id::text = folder and m.user_id = (select auth.uid()) and m.role = 'owner'
  )
$$;
revoke execute on function private.is_gallery_owner_folder(text) from public;
grant execute on function private.is_gallery_owner_folder(text) to authenticated;

create policy "members read processed" on storage.objects
  for select to authenticated
  using (bucket_id = 'processed' and private.is_gallery_folder((storage.foldername(name))[1]));
create policy "members read branding" on storage.objects
  for select to authenticated
  using (bucket_id = 'branding' and private.is_gallery_folder((storage.foldername(name))[1]));
create policy "owners upload branding" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'branding' and private.is_gallery_owner_folder((storage.foldername(name))[1]));
create policy "owners replace branding" on storage.objects
  for update to authenticated
  using (bucket_id = 'branding' and private.is_gallery_owner_folder((storage.foldername(name))[1]))
  with check (bucket_id = 'branding' and private.is_gallery_owner_folder((storage.foldername(name))[1]));
create policy "owners delete branding" on storage.objects
  for delete to authenticated
  using (bucket_id = 'branding' and private.is_gallery_owner_folder((storage.foldername(name))[1]));
create policy "signed-in users read platform and own backgrounds" on storage.objects
  for select to authenticated
  using (bucket_id = 'backgrounds' and ((storage.foldername(name))[1] = 'platform'
    or private.is_gallery_folder((storage.foldername(name))[1])));

-- Live progress in the app (design 11.3).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'photos') then
    alter publication supabase_realtime add table public.photos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'vehicles') then
    alter publication supabase_realtime add table public.vehicles;
  end if;
end
$$;

-- Queues a vehicle's photos and charges its credit the first time (design 9). Returns the queued ids.
-- Default: photos not yet processed or failed. p_rerender: every photo (background or watermark changed;
-- no new mask, no charge). p_photo_id: just that photo (touch-up, plate fix, re-shot).
-- Photos queued or processing for over 10 minutes count as stuck and are queued again.
create function public.start_processing(p_vehicle_id uuid, p_photo_id uuid default null, p_rerender boolean default false)
returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  v_gallery uuid;
  v_ids uuid[];
  v_stuck timestamptz := now() - interval '10 minutes';
begin
  select gallery_id into v_gallery from public.vehicles where id = p_vehicle_id;
  if v_gallery is null or not private.is_gallery_member(v_gallery) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  -- One start per gallery at a time: the balance check and the charge cannot interleave.
  perform 1 from public.galleries where id = v_gallery for update;

  select coalesce(array_agg(p.id order by p.slot), '{}') into v_ids
  from public.photos p
  where p.vehicle_id = p_vehicle_id
    and (p_photo_id is null or p.id = p_photo_id)
    and (
      (p.process_status in ('queued', 'processing') and p.updated_at < v_stuck)
      or (p.process_status not in ('queued', 'processing')
          and (p_rerender or p_photo_id is not null or p.process_status in ('unprocessed', 'failed')))
    );
  if cardinality(v_ids) = 0 then
    return v_ids;
  end if;

  -- Design 9: one record is not for many cars. Over 40 originals, photos never rendered (new or re-shot)
  -- are refused; re-rendering what was already processed (background, touch-up, plate) still works.
  if (select originals_count from public.vehicles where id = p_vehicle_id) > 40
     and exists (select 1 from public.photos where id = any (v_ids) and processed_at is null) then
    raise exception 'photo_limit';
  end if;

  if not exists (select 1 from public.credit_ledger where vehicle_id = p_vehicle_id and reason = 'vehicle') then
    if public.gallery_credit_balance(v_gallery) < 1 then
      raise exception 'no_credit';
    end if;
    insert into public.credit_ledger (gallery_id, amount, reason, vehicle_id) values (v_gallery, -1, 'vehicle', p_vehicle_id);
    update public.vehicles set credit_charged_at = now() where id = p_vehicle_id;
  end if;

  update public.photos set process_status = 'queued', process_error = null where id = any (v_ids);
  update public.vehicles v
  set status = 'processing',
      background_id = coalesce(v.background_id, g.default_background_id,
        (select b.id from public.backgrounds b where b.gallery_id is null order by b.sort_order limit 1))
  from public.galleries g
  where v.id = p_vehicle_id and g.id = v.gallery_id;
  return v_ids;
end
$$;
revoke execute on function public.start_processing(uuid, uuid, boolean) from public, anon;
grant execute on function public.start_processing(uuid, uuid, boolean) to authenticated;
