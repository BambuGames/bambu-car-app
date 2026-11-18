-- Vehicle detail columns, listings, listing texts, report reads and the reports bucket.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'staff-a@bambu.test'),
  ('00000000-0000-0000-0000-00000000000b', 'staff-b@bambu.test');
insert into public.galleries (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Galerie A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Galerie B');
insert into public.gallery_members (gallery_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'staff'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'staff');
insert into public.vehicles (id, gallery_id, make, model, body_type) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Volkswagen', 'Passat', 'kombi');
insert into public.report_reads (id, gallery_id, vehicle_id, files, status) values
  ('c1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000000', '{a.pdf}', 'reading');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$update public.vehicles set mileage_km = 120000, fuel = 'diesel' where id = 'a1000000-0000-0000-0000-000000000000'$$,
  'staff can write typed vehicle data');
select throws_ok(
  $$update public.vehicles set fuel = 'kerosene' where id = 'a1000000-0000-0000-0000-000000000000'$$,
  '23514', null, 'fuel outside the list is rejected');
select throws_ok(
  $$update public.vehicles set mileage_km = -1 where id = 'a1000000-0000-0000-0000-000000000000'$$,
  '23514', null, 'negative mileage is rejected');
select lives_ok(
  $$insert into public.listings (id, gallery_id) values ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000')$$,
  'staff can add a listing for an own vehicle');
select throws_ok(
  $$insert into public.listings (id, gallery_id) values ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000')$$,
  '23505', null, 'one listing per vehicle');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is_empty($$select 1 from public.listings$$, 'other gallery cannot see the listing');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$update public.report_reads set files = '{b.pdf}' where id = 'c1000000-0000-0000-0000-000000000000'$$,
  '42501', null, 'report_reads.files is not writable');

reset role;
select results_eq(
  $$select file_size_limit, allowed_mime_types from storage.buckets where id = 'reports'$$,
  $$values (20971520::bigint, '{application/pdf,image/jpeg,image/png}'::text[])$$,
  'reports bucket limits');

select is(
  (select count(*)::int from cron.job where jobname = 'clean-reports'), 1,
  'the clean-reports job is scheduled');

select * from finish();
rollback;
