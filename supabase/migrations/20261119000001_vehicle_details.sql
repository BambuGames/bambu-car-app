-- M3: typed vehicle data, listings, generated listing texts, report reads and the reports bucket.
-- Value lists mirror apps/mobile/src/domain/vehicleData.ts (mobile.de upload interface).
alter table public.vehicles
  add column variant text,
  add column first_registration date,
  add column mileage_km integer check (mileage_km >= 0),
  add column fuel text check (fuel in ('petrol','diesel','lpg','cng','electric','hybrid_petrol','hybrid_diesel','hydrogen','ethanol','other')),
  add column transmission text check (transmission in ('manual','semi_automatic','automatic')),
  add column power_kw integer check (power_kw > 0),
  add column displacement_ccm integer check (displacement_ccm > 0),
  add column drive text check (drive in ('front','rear','all')),
  add column color_exterior text check (color_exterior in ('beige','black','blue','brown','gold','green','grey','orange','purple','red','silver','white','yellow')),
  add column color_interior text check (color_interior in ('black','grey','beige','brown','other')),
  add column upholstery text check (upholstery in ('full_leather','part_leather','cloth','velour','alcantara','other')),
  add column previous_owners integer check (previous_owners >= 0),
  add column hu_until date,
  add column accident_free boolean,
  add column service_book boolean,
  add column non_smoker boolean,
  add column vin text check (char_length(vin) = 17),
  add column damage jsonb not null default '{}',
  add column damage_checked_at timestamptz;

-- Same list as 20261112000002_processing.sql plus the new columns.
revoke insert, update on public.vehicles from anon, authenticated;
grant insert (id, gallery_id, make, model, body_type, status, details, created_at, updated_at, background_id, tone_enabled,
    variant, first_registration, mileage_km, fuel, transmission, power_kw, displacement_ccm, drive, color_exterior,
    color_interior, upholstery, previous_owners, hu_until, accident_free, service_book, non_smoker, vin, damage, damage_checked_at),
  update (id, gallery_id, make, model, body_type, status, details, created_at, updated_at, background_id, tone_enabled,
    variant, first_registration, mileage_km, fuel, transmission, power_kw, displacement_ccm, drive, color_exterior,
    color_interior, upholstery, previous_owners, hu_until, accident_free, service_book, non_smoker, vin, damage, damage_checked_at)
  on public.vehicles to authenticated;

-- One listing per vehicle: its id is the vehicle id.
create table public.listings (
  id uuid primary key references public.vehicles,
  gallery_id uuid not null,
  status text not null default 'draft' check (status in ('draft')),
  price_eur integer check (price_eur >= 0),
  vat_deductible boolean,
  warranty_months integer check (warranty_months >= 0),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gallery_id),
  foreign key (id, gallery_id) references public.vehicles (id, gallery_id)
);
create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

create table public.listing_texts (
  listing_id uuid not null,
  gallery_id uuid not null,
  language text not null check (language in ('de','tr','en')),
  titles text[] not null,
  title text not null,
  description text not null,
  model text not null,
  generated_at timestamptz not null,
  edited boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (listing_id, language),
  foreign key (listing_id, gallery_id) references public.listings (id, gallery_id)
);
create trigger listing_texts_set_updated_at before update on public.listing_texts
  for each row execute function public.set_updated_at();

create table public.report_reads (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null,
  vehicle_id uuid not null,
  files text[] not null,
  status text not null check (status in ('reading','done','failed')),
  error text,
  suggestions jsonb,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, gallery_id) references public.vehicles (id, gallery_id)
);
create index report_reads_vehicle_id_idx on public.report_reads (vehicle_id);

alter table public.listings enable row level security;
alter table public.listing_texts enable row level security;
alter table public.report_reads enable row level security;

create policy "members read listings" on public.listings
  for select to authenticated using (private.is_gallery_member(gallery_id));
create policy "members add listings" on public.listings
  for insert to authenticated with check (private.is_gallery_member(gallery_id));
create policy "members update listings" on public.listings
  for update to authenticated using (private.is_gallery_member(gallery_id)) with check (private.is_gallery_member(gallery_id));
create policy "members read listing texts" on public.listing_texts
  for select to authenticated using (private.is_gallery_member(gallery_id));
create policy "members update listing texts" on public.listing_texts
  for update to authenticated using (private.is_gallery_member(gallery_id)) with check (private.is_gallery_member(gallery_id));
create policy "members read report reads" on public.report_reads
  for select to authenticated using (private.is_gallery_member(gallery_id));
create policy "members update report reads" on public.report_reads
  for update to authenticated using (private.is_gallery_member(gallery_id)) with check (private.is_gallery_member(gallery_id));

-- Column rights: inserts of texts and report reads come from functions (service role).
revoke all on public.listings, public.listing_texts, public.report_reads from anon, authenticated;
grant select on public.listings, public.listing_texts, public.report_reads to authenticated;
grant insert (id, gallery_id, status, price_eur, vat_deductible, warranty_months, location, created_at, updated_at),
  update (id, gallery_id, status, price_eur, vat_deductible, warranty_months, location, created_at, updated_at)
  on public.listings to authenticated;
grant update (title, description, edited) on public.listing_texts to authenticated;
grant update (suggestions, closed_at) on public.report_reads to authenticated;

-- Private bucket for uploaded vehicle reports.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 20 * 1024 * 1024, '{application/pdf,image/jpeg,image/png}');

create policy "members read reports" on storage.objects
  for select to authenticated
  using (bucket_id = 'reports' and private.is_gallery_folder((storage.foldername(name))[1]));
create policy "members upload reports" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reports' and private.is_gallery_folder((storage.foldername(name))[1]));
create policy "members delete reports" on storage.objects
  for delete to authenticated
  using (bucket_id = 'reports' and private.is_gallery_folder((storage.foldername(name))[1]));
