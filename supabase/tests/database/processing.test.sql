-- Processing (design 7.5, 9, 11.3): start_processing charges a vehicle once and queues its photos; the
-- server's results and statuses are protected from members and from stale pushes of the app.
begin;
select plan(33);

-- As postgres. Testgalerie (e…1): owner d…1, staff d…2. Andere Galerie (e…2): owner d…3.
insert into public.vehicles (id, gallery_id, make, model, body_type) values
  ('a2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'VW', 'Passat', 'kombi'),
  ('a2000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'VW', 'Golf', 'hatchback'),
  ('a2000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'BMW', '320d', 'sedan');
insert into public.photos (id, vehicle_id, gallery_id, slot, original_path, captured_at) values
  ('f2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'front_left_45', 'e0000000-0000-0000-0000-000000000001/a2000000-0000-0000-0000-000000000001/front_left_45.jpg', now()),
  ('f2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'front', 'e0000000-0000-0000-0000-000000000001/a2000000-0000-0000-0000-000000000001/front.jpg', now()),
  ('f2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'detail_wheel', 'e0000000-0000-0000-0000-000000000001/a2000000-0000-0000-0000-000000000001/detail_wheel.jpg', now()),
  ('f2000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'front', 'e0000000-0000-0000-0000-000000000001/a2000000-0000-0000-0000-000000000002/front.jpg', now()),
  ('f2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'front', 'e0000000-0000-0000-0000-000000000001/a2000000-0000-0000-0000-000000000003/front.jpg', now());
-- Exactly one credit, whatever earlier test runs left in the local ledger (rolled back at the end).
delete from public.credit_ledger where gallery_id = 'e0000000-0000-0000-0000-000000000001';
select public.admin_grant_credits('e0000000-0000-0000-0000-000000000001', 1, 'test');

-- The owner starts the first vehicle.
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(cardinality(public.start_processing('a2000000-0000-0000-0000-000000000001')), 3,
  'first start queues the three photos');
select is(public.gallery_credit_balance('e0000000-0000-0000-0000-000000000001'), 0,
  'first start charges one credit');
select results_eq(
  $$select status::text, credit_charged_at is not null, background_id from public.vehicles
    where id = 'a2000000-0000-0000-0000-000000000001'$$,
  $$values ('processing', true, 'b0000000-0000-0000-0000-000000000001'::uuid)$$,
  'the vehicle is processing, charged, and gets the first studio background'
);
select throws_ok(
  $$select public.start_processing('a2000000-0000-0000-0000-000000000002')$$,
  'P0001', 'no_credit',
  'no credit: processing does not start'
);
select results_eq(
  $$select process_status::text from public.photos where id = 'f2000000-0000-0000-0000-000000000004'$$,
  $$values ('unprocessed')$$,
  'no credit leaves the photos as they were'
);

-- The worker finishes (service role in production; postgres here).
reset role;
update public.photos set process_status = 'done', mask_path = 'm.png' where vehicle_id = 'a2000000-0000-0000-0000-000000000001';
set local role authenticated;
select is(cardinality(public.start_processing('a2000000-0000-0000-0000-000000000001', null, true)), 3,
  'a re-render queues every photo');
select results_eq(
  $$select count(*)::int from public.credit_ledger where vehicle_id = 'a2000000-0000-0000-0000-000000000001'$$,
  $$values (1)$$,
  'second start does not charge'
);

reset role;
update public.photos set process_status = 'done' where vehicle_id = 'a2000000-0000-0000-0000-000000000001';
update public.photos set process_status = 'failed', process_error = 'internal' where id = 'f2000000-0000-0000-0000-000000000002';
set local role authenticated;
select results_eq(
  $$select public.start_processing('a2000000-0000-0000-0000-000000000001')$$,
  $$values (array['f2000000-0000-0000-0000-000000000002']::uuid[])$$,
  'a plain start queues only the failed photo'
);
select results_eq(
  $$select count(*)::int from public.credit_ledger where vehicle_id = 'a2000000-0000-0000-0000-000000000001'$$,
  $$values (1)$$,
  'reprocessing does not charge again'
);

-- Stuck photos: queued or processing for more than 10 minutes.
reset role;
alter table public.photos disable trigger photos_set_updated_at;
update public.photos set process_status = 'processing', updated_at = now() - interval '11 minutes'
  where id = 'f2000000-0000-0000-0000-000000000001';
update public.photos set process_status = 'processing', updated_at = now() - interval '5 minutes'
  where id = 'f2000000-0000-0000-0000-000000000002';
update public.photos set process_status = 'done' where id = 'f2000000-0000-0000-0000-000000000003';
alter table public.photos enable trigger photos_set_updated_at;
set local role authenticated;
select results_eq(
  $$select public.start_processing('a2000000-0000-0000-0000-000000000001')$$,
  $$values (array['f2000000-0000-0000-0000-000000000001']::uuid[])$$,
  'stuck photos can be queued again after 10 minutes'
);

-- M5: only the owner starts the processing that charges a credit. The balance is 0 here, and staff
-- still hear not_owner, not no_credit.
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select public.start_processing('a2000000-0000-0000-0000-000000000002')$$,
  '42501', 'not_owner',
  'staff cannot start the first, charged processing'
);
select results_eq(
  $$select (select count(*)::int from public.credit_ledger where vehicle_id = 'a2000000-0000-0000-0000-000000000002'),
           (select process_status::text from public.photos where id = 'f2000000-0000-0000-0000-000000000004')$$,
  $$values (0, 'unprocessed')$$,
  'a refused start charges nothing and queues nothing'
);

-- The last credit goes to one vehicle.
reset role;
select public.admin_grant_credits('e0000000-0000-0000-0000-000000000001', 1, 'test');
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(cardinality(public.start_processing('a2000000-0000-0000-0000-000000000002')), 1,
  'the owner starts it');
select throws_ok(
  $$select public.start_processing('a2000000-0000-0000-0000-000000000003')$$,
  'P0001', 'no_credit',
  'last credit goes to one vehicle'
);

-- A re-shot photo starts over.
reset role;
update public.photos set process_status = 'done', mask_path = 'm.png', output_path = 'o.jpg', output_wm_path = 'w.jpg',
  plate_status = 'confirmed', plate_corners = '[[0,0],[1,0],[1,1],[0,1]]', mask_edits = '[{"type":"remove","point":[0.1,0.1]}]'
  where id = 'f2000000-0000-0000-0000-000000000003';
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';
update public.photos set original_path = 'e0000000-0000-0000-0000-000000000001/a2000000-0000-0000-0000-000000000001/detail_wheel-b.jpg' where id = 'f2000000-0000-0000-0000-000000000003';
select results_eq(
  $$select process_status::text, mask_path, output_path, plate_status::text, mask_edits from public.photos
    where id = 'f2000000-0000-0000-0000-000000000003'$$,
  $$values ('unprocessed', null::text, null::text, null::text, '[]'::jsonb)$$,
  'replacing the original resets processing'
);

-- The app's stale status does not undo the server's.
reset role;
update public.vehicles set status = 'ready' where id = 'a2000000-0000-0000-0000-000000000001';
set local role authenticated;
update public.vehicles set status = 'shooting' where id = 'a2000000-0000-0000-0000-000000000001';
select results_eq(
  $$select status::text from public.vehicles where id = 'a2000000-0000-0000-0000-000000000001'$$,
  $$values ('ready')$$,
  'a client push does not move a processed vehicle back'
);
update public.vehicles set status = 'archived' where id = 'a2000000-0000-0000-0000-000000000001';
select results_eq(
  $$select status::text from public.vehicles where id = 'a2000000-0000-0000-0000-000000000001'$$,
  $$values ('archived')$$,
  'a processed vehicle can still be archived'
);

select throws_ok(
  $$update public.photos set process_status = 'done' where id = 'f2000000-0000-0000-0000-000000000004'$$,
  '42501', null,
  'members cannot write processing results'
);
select throws_ok(
  $$update public.vehicles set credit_charged_at = now() where id = 'a2000000-0000-0000-0000-000000000003'$$,
  '42501', null,
  'members cannot mark a vehicle as charged'
);
select lives_ok(
  $$update public.photos set mask_edits = '[{"type":"remove","point":[0.5,0.5]}]', plate_status = 'none'
    where id = 'f2000000-0000-0000-0000-000000000004'$$,
  'members can write touch-up edits and plate decisions'
);

set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$select public.start_processing('a2000000-0000-0000-0000-000000000003')$$,
  '42501', null,
  'another gallery cannot start processing'
);
select results_eq(
  $$select count(*)::int from public.backgrounds where gallery_id is null$$,
  $$values (3)$$,
  'members read the three studio backgrounds'
);

-- The app re-shoots onto the same path (sync.ts photoPath): a new captured_at is a new original.
reset role;
update public.photos set captured_at = '2026-11-01T10:00:00Z' where id = 'f2000000-0000-0000-0000-000000000005';
update public.photos set process_status = 'done', mask_path = 'm.png', output_path = 'o.jpg', plate_status = 'auto',
  tone_stats = '{"L":50}' where id = 'f2000000-0000-0000-0000-000000000005';
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';
update public.photos set captured_at = '2026-11-01T10:00:00Z', qc = '{}' where id = 'f2000000-0000-0000-0000-000000000005';
select results_eq(
  $$select process_status::text, mask_path from public.photos where id = 'f2000000-0000-0000-0000-000000000005'$$,
  $$values ('done', 'm.png')$$,
  'a repeated push of the same photo keeps its results'
);
update public.photos set captured_at = '2026-11-02T10:00:00Z' where id = 'f2000000-0000-0000-0000-000000000005';
select results_eq(
  $$select process_status::text, mask_path, output_path, tone_stats from public.photos
    where id = 'f2000000-0000-0000-0000-000000000005'$$,
  $$values ('unprocessed', null::text, null::text, null::jsonb)$$,
  'a re-shot photo on the same path resets processing'
);

-- Design 9: a cap per vehicle so one record is not used for other cars (re-shoots count).
select results_eq(
  $$select originals_count from public.vehicles where id = 'a2000000-0000-0000-0000-000000000003'$$,
  $$values (3)$$,
  'every new original of a vehicle is counted (insert, then two new captures; a repeated push does not count)'
);
reset role;
update public.vehicles set originals_count = 41 where id = 'a2000000-0000-0000-0000-000000000003';
select public.admin_grant_credits('e0000000-0000-0000-0000-000000000001', 1, 'test');
set local role authenticated;
select throws_ok(
  $$select public.start_processing('a2000000-0000-0000-0000-000000000003')$$,
  'P0001', 'photo_limit',
  'a vehicle with more than 40 originals cannot process new photos'
);
reset role;
update public.photos set process_status = 'done', processed_at = now() where id = 'f2000000-0000-0000-0000-000000000005';
insert into public.credit_ledger (gallery_id, amount, reason, vehicle_id) values ('e0000000-0000-0000-0000-000000000001', -1, 'vehicle', 'a2000000-0000-0000-0000-000000000003');
set local role authenticated;
select is(cardinality(public.start_processing('a2000000-0000-0000-0000-000000000003', null, true)), 1,
  'a re-render still works over the limit');

-- Paths and backgrounds stay inside the gallery: the worker reads them with the service role.
select throws_ok(
  $$update public.photos set original_path = 'e0000000-0000-0000-0000-000000000002/x/front.jpg'
    where id = 'f2000000-0000-0000-0000-000000000004'$$,
  '23514', null,
  'an original path must be inside its own vehicle folder'
);
select throws_ok(
  $$update public.photos set original_path = 'e0000000-0000-0000-0000-000000000001/a2000000-0000-0000-0000-000000000002/../../x.jpg'
    where id = 'f2000000-0000-0000-0000-000000000004'$$,
  '23514', null,
  'an original path cannot climb out of its folder'
);
select throws_ok(
  $$update public.galleries set logo_path = 'e0000000-0000-0000-0000-000000000002/logo.png' where id = 'e0000000-0000-0000-0000-000000000001'$$,
  '23514', null,
  'a branding path must be inside the gallery folder'
);
reset role;
insert into public.backgrounds (id, gallery_id, name, spec) values
  ('b1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Andere', '{"kind":"studio","wall":"#000000","floor":"#000000"}');
set local role authenticated;
select throws_ok(
  $$update public.vehicles set background_id = 'b1000000-0000-0000-0000-000000000001'
    where id = 'a2000000-0000-0000-0000-000000000002'$$,
  '42501', null,
  'another gallery''s background cannot be used'
);

-- M5: once the vehicle is paid, staff process it as before, without a second charge.
reset role;
update public.photos set process_status = 'done' where vehicle_id = 'a2000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(cardinality(public.start_processing('a2000000-0000-0000-0000-000000000001', null, true)), 3,
  'staff can re-render a paid vehicle');
reset role; -- staff cannot read the ledger (owners only), so count as postgres
select results_eq(
  $$select count(*)::int from public.credit_ledger where vehicle_id = 'a2000000-0000-0000-0000-000000000001'$$,
  $$values (1)$$,
  'staff re-render does not charge'
);

select * from finish();
rollback;
