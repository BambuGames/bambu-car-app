-- M3 review fixes: when the facts behind a listing text last changed, a stale push cannot move a status between
-- processing and ready, and clean-reports can find report files no read row points at.

-- facts_updated_at moves only when something the listing text is written from changes (write-listing's columns;
-- the VIN never reaches the text). Photo counts, statuses, studio options and the like leave it alone, so the
-- app's "text is out of date" note does not fire on server bookkeeping. Clients cannot write it (not granted).
alter table public.vehicles add column facts_updated_at timestamptz not null default now();
alter table public.listings add column facts_updated_at timestamptz not null default now();

create function private.stamp_facts() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.facts_updated_at := now();
  return new;
end
$$;
create trigger vehicles_stamp_facts before update on public.vehicles
  for each row when ((old.make, old.model, old.variant, old.body_type, old.first_registration, old.mileage_km, old.fuel,
    old.transmission, old.power_kw, old.displacement_ccm, old.drive, old.color_exterior, old.color_interior,
    old.upholstery, old.previous_owners, old.hu_until, old.accident_free, old.service_book, old.non_smoker,
    old.details, old.damage, old.damage_checked_at)
    is distinct from (new.make, new.model, new.variant, new.body_type, new.first_registration, new.mileage_km, new.fuel,
    new.transmission, new.power_kw, new.displacement_ccm, new.drive, new.color_exterior, new.color_interior,
    new.upholstery, new.previous_owners, new.hu_until, new.accident_free, new.service_book, new.non_smoker,
    new.details, new.damage, new.damage_checked_at))
  execute function private.stamp_facts();
create trigger listings_stamp_facts before update on public.listings
  for each row when ((old.price_eur, old.vat_deductible, old.warranty_months, old.location)
    is distinct from (new.price_eur, new.vat_deductible, new.warranty_months, new.location))
  execute function private.stamp_facts();

-- The app pushes the status it last pulled. Besides draft/shooting never undoing processing/ready, a member's
-- push cannot swap processing and ready either (a stale "processing" would leave a finished vehicle stuck).
-- start_processing runs as its owner and the worker as service_role, so both still move the status.
create or replace function private.keep_server_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status in ('processing', 'ready') and (new.status in ('draft', 'shooting')
      or (current_user = 'authenticated' and new.status in ('processing', 'ready'))) then
    new.status := old.status;
  end if;
  return new;
end
$$;

-- Report files older than the cutoff, whether a read row points at them or not (an upload cut off before
-- read-report recorded it has none). clean-reports deletes them through the Storage API. Service role only.
create function public.old_report_files(p_before timestamptz) returns table (name text)
language sql stable set search_path = '' as $$
  select o.name from storage.objects o where o.bucket_id = 'reports' and o.created_at < p_before order by o.name
$$;
revoke execute on function public.old_report_files(timestamptz) from public, anon, authenticated;
grant execute on function public.old_report_files(timestamptz) to service_role;
