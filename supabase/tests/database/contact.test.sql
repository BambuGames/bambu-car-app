-- Gallery contact numbers: the owner writes them, staff cannot, and the length is capped.
begin;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'staff-a@bambu.test'),
  ('00000000-0000-0000-0000-0000000000a0', 'owner-a@bambu.test');
insert into public.galleries (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Galerie A');
insert into public.gallery_members (gallery_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'staff'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a0', 'owner');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}';

select isnt_empty(
  $$update public.galleries set phone = '+49 30 1234567', whatsapp = '+49 170 1234567' returning id$$,
  'owner sets phone and whatsapp');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is_empty(
  $$update public.galleries set phone = '999999' returning id$$,
  'staff update changes nothing');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}';

select throws_ok(
  $$update public.galleries set phone = repeat('1', 31)$$,
  '23514', null, 'a 31-character phone is rejected');

select * from finish();
rollback;
