-- M3 review fixes: facts_updated_at moves only when a fact behind the listing text changes; a member's stale
-- push cannot swap processing and ready; old_report_files lists old report files for the service role only.
begin;
select plan(19);

-- As postgres. Testgalerie (e…1): owner d…1. Vehicle 1 for the stamp, vehicle 2 for the status.
insert into public.vehicles (id, gallery_id, make, model, body_type, status) values
  ('a4000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'VW', 'Golf', 'hatchback', 'ready'),
  ('a4000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'VW', 'Polo', 'hatchback', 'ready');
insert into public.listings (id, gallery_id) values
  ('a4000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001');
insert into public.photos (id, vehicle_id, gallery_id, slot, original_path, captured_at, process_status) values
  ('f4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001',
   'front', 'e0000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000002/front.jpg', now(), 'done');
insert into public.credit_ledger (gallery_id, amount, reason, vehicle_id) values
  ('e0000000-0000-0000-0000-000000000001', -1, 'vehicle', 'a4000000-0000-0000-0000-000000000002');
update public.vehicles set facts_updated_at = '2026-01-01' where id = 'a4000000-0000-0000-0000-000000000001';
update public.listings set facts_updated_at = '2026-01-01' where id = 'a4000000-0000-0000-0000-000000000001';

-- Server bookkeeping: counts, status, studio options, the charge.
update public.vehicles set originals_count = 3, status = 'processing', tone_enabled = false, credit_charged_at = now()
  where id = 'a4000000-0000-0000-0000-000000000001';
select is((select facts_updated_at from public.vehicles where id = 'a4000000-0000-0000-0000-000000000001'),
  '2026-01-01'::timestamptz, 'server bookkeeping does not move vehicles.facts_updated_at');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- The app pushes its whole row; unchanged facts leave the stamp alone.
update public.vehicles set make = 'VW', model = 'Golf', body_type = 'hatchback', details = '{}', damage = '{}',
  status = 'shooting', updated_at = now() where id = 'a4000000-0000-0000-0000-000000000001';
select is((select facts_updated_at from public.vehicles where id = 'a4000000-0000-0000-0000-000000000001'),
  '2026-01-01'::timestamptz, 'a push with unchanged facts does not move it');
update public.vehicles set vin = 'WVWZZZ1KZAW000001' where id = 'a4000000-0000-0000-0000-000000000001';
select is((select facts_updated_at from public.vehicles where id = 'a4000000-0000-0000-0000-000000000001'),
  '2026-01-01'::timestamptz, 'the VIN (never part of the text) does not move it');
update public.vehicles set mileage_km = 1000 where id = 'a4000000-0000-0000-0000-000000000001';
select is((select facts_updated_at from public.vehicles where id = 'a4000000-0000-0000-0000-000000000001'),
  now(), 'a typed data change stamps it');
reset role;
update public.vehicles set facts_updated_at = '2026-01-01' where id = 'a4000000-0000-0000-0000-000000000001';
set local role authenticated;
update public.vehicles set details = '{"notes":"neu"}' where id = 'a4000000-0000-0000-0000-000000000001';
select is((select facts_updated_at from public.vehicles where id = 'a4000000-0000-0000-0000-000000000001'),
  now(), 'a details change stamps it');

update public.listings set status = 'draft', updated_at = now() where id = 'a4000000-0000-0000-0000-000000000001';
select is((select facts_updated_at from public.listings where id = 'a4000000-0000-0000-0000-000000000001'),
  '2026-01-01'::timestamptz, 'a listing push with unchanged sale fields does not move listings.facts_updated_at');
update public.listings set price_eur = 15000 where id = 'a4000000-0000-0000-0000-000000000001';
select is((select facts_updated_at from public.listings where id = 'a4000000-0000-0000-0000-000000000001'),
  now(), 'a price change stamps it');

select throws_ok(
  $$update public.vehicles set facts_updated_at = now() where id = 'a4000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'members cannot write vehicles.facts_updated_at');
select throws_ok(
  $$update public.listings set facts_updated_at = now() where id = 'a4000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'members cannot write listings.facts_updated_at');

-- Status: a stale push of the app does not move ready back to processing; start_processing still does.
update public.vehicles set status = 'processing' where id = 'a4000000-0000-0000-0000-000000000002';
select is((select status::text from public.vehicles where id = 'a4000000-0000-0000-0000-000000000002'),
  'ready', 'a member''s push does not move a ready vehicle to processing');
select is(cardinality(public.start_processing('a4000000-0000-0000-0000-000000000002', null, true)), 1,
  'start_processing re-renders the ready vehicle');
select is((select status::text from public.vehicles where id = 'a4000000-0000-0000-0000-000000000002'),
  'processing', 'and moves it to processing');
update public.vehicles set status = 'ready' where id = 'a4000000-0000-0000-0000-000000000002';
select is((select status::text from public.vehicles where id = 'a4000000-0000-0000-0000-000000000002'),
  'processing', 'a member''s push does not move a processing vehicle to ready');
update public.vehicles set status = 'archived' where id = 'a4000000-0000-0000-0000-000000000002';
select is((select status::text from public.vehicles where id = 'a4000000-0000-0000-0000-000000000002'),
  'archived', 'archiving stays the member''s');
reset role;
update public.vehicles set status = 'ready' where id = 'a4000000-0000-0000-0000-000000000001';
select is((select status::text from public.vehicles where id = 'a4000000-0000-0000-0000-000000000001'),
  'ready', 'the server (not a member) moves processing to ready');

-- Old report files: service role only, and only the reports bucket before the cutoff.
select ok(not has_function_privilege('anon', 'public.old_report_files(timestamptz)', 'execute'), 'anon cannot list report files');
select ok(not has_function_privilege('authenticated', 'public.old_report_files(timestamptz)', 'execute'),
  'members cannot list report files');
select ok(has_function_privilege('service_role', 'public.old_report_files(timestamptz)', 'execute'),
  'the service role can list report files');
insert into storage.objects (bucket_id, name, created_at) values
  ('reports', 'facts-test/old.pdf', now() - interval '8 days'),
  ('reports', 'facts-test/new.pdf', now() - interval '6 days'),
  ('originals', 'facts-test/old.jpg', now() - interval '8 days');
select results_eq(
  $$select name from public.old_report_files(now() - interval '7 days') where name like 'facts-test/%'$$,
  $$values ('facts-test/old.pdf')$$,
  'old_report_files lists report files older than the cutoff only');

select * from finish();
rollback;
