-- Core schema: galleries and their members, the vehicle catalog, vehicles and photos.
-- Every gallery sees only its own data (row level security).

create type public.member_role as enum ('owner', 'staff');
create type public.body_type as enum ('sedan', 'kombi', 'suv', 'hatchback', 'other');
create type public.vehicle_status as enum ('draft', 'shooting', 'processing', 'ready', 'archived');

create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.gallery_members (
  gallery_id uuid not null references public.galleries on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (gallery_id, user_id)
);
create index gallery_members_user_id_idx on public.gallery_members (user_id);

create table public.makes (
  id int generated always as identity primary key,
  name text not null unique
);

create table public.models (
  id int generated always as identity primary key,
  make_id int not null references public.makes on delete cascade,
  name text not null,
  unique (make_id, name)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries,
  make text not null,
  model text not null,
  body_type public.body_type not null,
  status public.vehicle_status not null default 'draft',
  details jsonb not null default '{}',
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gallery_id)
);
create index vehicles_gallery_id_idx on public.vehicles (gallery_id);

create table public.photos (
  id uuid primary key,
  vehicle_id uuid not null,
  gallery_id uuid not null,
  slot text not null check (slot in (
    'front_left_45', 'front', 'front_right_45', 'right', 'rear_right_45', 'rear', 'rear_left_45', 'left',
    'detail_wheel', 'detail_headlights', 'detail_taillights', 'detail_trunk_open', 'detail_engine', 'detail_roof', 'detail_other',
    'interior_cockpit', 'interior_console', 'interior_instruments', 'interior_front_seats', 'interior_rear_seats',
    'interior_door', 'interior_trunk', 'interior_headliner', 'interior_other'
  )),
  original_path text not null,
  captured_at timestamptz not null,
  capture jsonb not null default '{}',
  qc jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id, slot),
  -- A photo always belongs to a vehicle of the same gallery.
  foreign key (vehicle_id, gallery_id) references public.vehicles (id, gallery_id) on delete cascade
);
create index photos_gallery_id_idx on public.photos (gallery_id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end
$$;
create trigger vehicles_set_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();
create trigger photos_set_updated_at before update on public.photos
  for each row execute function public.set_updated_at();

-- Membership checks for the policies. Security definer so that reading gallery_members
-- inside a policy does not run that table's own policy again.
create schema private;
grant usage on schema private to authenticated;

create function private.is_gallery_member(gallery uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gallery_members m
    where m.gallery_id = gallery and m.user_id = (select auth.uid())
  )
$$;

create function private.is_gallery_owner(gallery uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gallery_members m
    where m.gallery_id = gallery and m.user_id = (select auth.uid()) and m.role = 'owner'
  )
$$;

-- Storage paths start with the gallery id. Compared as text so that a malformed path
-- is simply not a member's folder instead of failing a uuid cast.
create function private.is_gallery_folder(folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gallery_members m
    where m.gallery_id::text = folder and m.user_id = (select auth.uid())
  )
$$;

revoke execute on function private.is_gallery_member(uuid), private.is_gallery_owner(uuid),
  private.is_gallery_folder(text) from public;
grant execute on function private.is_gallery_member(uuid), private.is_gallery_owner(uuid),
  private.is_gallery_folder(text) to authenticated;

alter table public.galleries enable row level security;
alter table public.gallery_members enable row level security;
alter table public.makes enable row level security;
alter table public.models enable row level security;
alter table public.vehicles enable row level security;
alter table public.photos enable row level security;

create policy "members read their gallery" on public.galleries
  for select to authenticated using (private.is_gallery_member(id));
create policy "owners update their gallery" on public.galleries
  for update to authenticated using (private.is_gallery_owner(id)) with check (private.is_gallery_owner(id));

-- Members are added and removed only by the admin functions (service role / SQL editor).
create policy "members read their gallery's members" on public.gallery_members
  for select to authenticated using (private.is_gallery_member(gallery_id));

create policy "signed-in users read makes" on public.makes for select to authenticated using (true);
create policy "signed-in users read models" on public.models for select to authenticated using (true);

-- No delete policies: vehicles are archived, not deleted.
create policy "members read vehicles" on public.vehicles
  for select to authenticated using (private.is_gallery_member(gallery_id));
create policy "members add vehicles" on public.vehicles
  for insert to authenticated with check (private.is_gallery_member(gallery_id));
create policy "members update vehicles" on public.vehicles
  for update to authenticated using (private.is_gallery_member(gallery_id)) with check (private.is_gallery_member(gallery_id));

create policy "members read photos" on public.photos
  for select to authenticated using (private.is_gallery_member(gallery_id));
create policy "members add photos" on public.photos
  for insert to authenticated with check (private.is_gallery_member(gallery_id));
create policy "members update photos" on public.photos
  for update to authenticated using (private.is_gallery_member(gallery_id)) with check (private.is_gallery_member(gallery_id));

-- Original photos live in a private bucket at {gallery_id}/{vehicle_id}/{slot}.jpg.
insert into storage.buckets (id, name, public) values ('originals', 'originals', false);

create policy "members read originals" on storage.objects
  for select to authenticated
  using (bucket_id = 'originals' and private.is_gallery_folder((storage.foldername(name))[1]));
create policy "members upload originals" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'originals' and private.is_gallery_folder((storage.foldername(name))[1]));
create policy "members replace originals" on storage.objects
  for update to authenticated
  using (bucket_id = 'originals' and private.is_gallery_folder((storage.foldername(name))[1]))
  with check (bucket_id = 'originals' and private.is_gallery_folder((storage.foldername(name))[1]));
