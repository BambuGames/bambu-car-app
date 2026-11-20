-- M5 roles (docs/superpowers/specs/2026-11-19-m5-roles-design.md 5.1): only the gallery's owner starts the
-- processing that charges a vehicle's credit. Once the vehicle is paid, staff process it as before.
-- Same function as 20261112000002_processing.sql with one check added.

-- Queues a vehicle's photos and charges its credit the first time (design 9). Returns the queued ids.
-- Default: photos not yet processed or failed. p_rerender: every photo (background or watermark changed;
-- no new mask, no charge). p_photo_id: just that photo (touch-up, plate fix, re-shot).
-- Photos queued or processing for over 10 minutes count as stuck and are queued again.
create or replace function public.start_processing(p_vehicle_id uuid, p_photo_id uuid default null, p_rerender boolean default false)
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
    -- M5: only the owner spends a credit. Checked before the balance, so staff never learn it.
    if not private.is_gallery_owner(v_gallery) then
      raise exception 'not_owner' using errcode = '42501';
    end if;
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
