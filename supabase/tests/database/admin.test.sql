-- Admin functions (called by Bambu Games from the SQL editor) and the vehicle catalog.
begin;
select plan(6);

-- As postgres, like the dashboard's SQL editor.
insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000000', 'new-owner@bambu.test'),
  ('c1000000-0000-0000-0000-000000000000', 'new-staff@bambu.test');

select isnt(
  public.admin_create_gallery('Autohaus Test', 'new-owner@bambu.test'), null,
  'admin_create_gallery returns the new gallery id'
);
select results_eq(
  $$select m.role::text from public.gallery_members m
    join public.galleries g on g.id = m.gallery_id where g.name = 'Autohaus Test'$$,
  $$values ('owner')$$,
  'the owner membership is created'
);
select lives_ok(
  $$select public.admin_add_member((select id from public.galleries where name = 'Autohaus Test'), 'new-staff@bambu.test', 'staff')$$,
  'admin_add_member adds staff'
);
select throws_ok(
  $$select public.admin_create_gallery('X', 'nobody@bambu.test')$$,
  'P0001', 'no user with email nobody@bambu.test; invite the user first',
  'unknown email is rejected'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000000","role":"authenticated"}';

select throws_ok(
  $$select public.admin_create_gallery('Y', 'new-owner@bambu.test')$$,
  '42501', null,
  'signed-in users cannot call admin functions'
);
select isnt_empty(
  'select 1 from public.makes',
  'signed-in users can read the make list'
);

select * from finish();
rollback;
