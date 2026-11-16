-- Gallery isolation, data integrity and storage access for the core schema.
begin;
select plan(12);

-- Fixtures, created as postgres (RLS does not apply).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'staff-a@bambu.test'),
  ('00000000-0000-0000-0000-0000000000a0', 'owner-a@bambu.test'),
  ('00000000-0000-0000-0000-00000000000b', 'staff-b@bambu.test');
insert into public.galleries (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Galerie A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Galerie B');
insert into public.gallery_members (gallery_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'staff'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a0', 'owner'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'staff');
insert into public.vehicles (id, gallery_id, make, model, body_type) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Volkswagen', 'Passat', 'kombi'),
  ('b1000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'BMW', '320d', 'sedan');

-- Staff of gallery A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select results_eq(
  'select id from public.vehicles',
  $$values ('a1000000-0000-0000-0000-000000000000'::uuid)$$,
  'staff sees only own gallery vehicles'
);
select lives_ok(
  $$insert into public.vehicles (id, gallery_id, make, model, body_type)
    values ('a2000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Audi', 'A4', 'sedan')$$,
  'staff can add a vehicle to own gallery'
);
select throws_ok(
  $$insert into public.vehicles (id, gallery_id, make, model, body_type)
    values ('a3000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'Audi', 'A6', 'sedan')$$,
  '42501', null,
  'staff cannot add a vehicle to another gallery'
);
select is_empty(
  $$update public.galleries set name = 'x' returning id$$,
  'staff cannot rename the gallery'
);
select throws_ok(
  $$insert into public.photos (id, vehicle_id, gallery_id, slot, original_path, captured_at)
    values ('c1000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000',
            'front', 'aaaaaaaa-0000-0000-0000-000000000000/b1000000-0000-0000-0000-000000000000/front.jpg', now())$$,
  '23503', null,
  'photo cannot point at another gallery''s vehicle'
);
select lives_ok(
  $$insert into public.photos (id, vehicle_id, gallery_id, slot, original_path, captured_at)
    values ('c2000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000',
            'front', 'aaaaaaaa-0000-0000-0000-000000000000/a1000000-0000-0000-0000-000000000000/front.jpg', now())$$,
  'staff can add a photo to own vehicle'
);
select throws_ok(
  $$insert into public.photos (id, vehicle_id, gallery_id, slot, original_path, captured_at)
    values ('c3000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000',
            'front', 'aaaaaaaa-0000-0000-0000-000000000000/a1000000-0000-0000-0000-000000000000/front.jpg', now())$$,
  '23505', null,
  'one photo per vehicle and slot'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('originals', 'aaaaaaaa-0000-0000-0000-000000000000/a1000000-0000-0000-0000-000000000000/front.jpg')$$,
  'member can upload under own gallery folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('originals', 'bbbbbbbb-0000-0000-0000-000000000000/b1000000-0000-0000-0000-000000000000/front.jpg')$$,
  '42501', null,
  'member cannot upload under another gallery folder'
);

-- Owner of gallery A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}';

select isnt_empty(
  $$update public.galleries set name = 'Galerie A2' returning id$$,
  'owner can rename the gallery'
);

-- Not signed in
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is_empty(
  'select id from public.vehicles',
  'anon sees no vehicles'
);

reset role;
select ok((select count(*) from public.makes) >= 30 and exists (select 1 from public.makes where name = 'Volkswagen'),
  'the vehicle catalog comes with the migrations');

select * from finish();
rollback;
