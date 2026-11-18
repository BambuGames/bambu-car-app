-- Chery sells in Germany since 2025 and was missing from the catalog (phone round 1: typed in by hand).
-- Same pattern as 20261116000001_vehicle_catalog.sql; safe to run again.
insert into public.makes (name) values ('Chery') on conflict (name) do nothing;
insert into public.models (make_id, name)
select m.id, unnest(array['Tiggo 4', 'Tiggo 7', 'Tiggo 8']) from public.makes m where m.name = 'Chery'
on conflict (make_id, name) do nothing;
