-- Local development data. `supabase db reset` loads it; it is never applied to the hosted project.

-- Dev accounts, password dev-password-1 for all:
--   owner@bambu.test (owner) and staff@bambu.test (staff) in "Testgalerie"
--   other@bambu.test (owner) in "Andere Galerie", to check that galleries cannot see each other.
-- GoTrue reads the token columns as strings, so they must be '' instead of null.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email,
  extensions.crypt('dev-password-1', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', '', '', '', '', ''
from (values
  ('d0000000-0000-0000-0000-000000000001', 'owner@bambu.test'),
  ('d0000000-0000-0000-0000-000000000002', 'staff@bambu.test'),
  ('d0000000-0000-0000-0000-000000000003', 'other@bambu.test')
) as dev(id, email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users
where email in ('owner@bambu.test', 'staff@bambu.test', 'other@bambu.test');

insert into public.galleries (id, name) values
  ('e0000000-0000-0000-0000-000000000001', 'Testgalerie'),
  ('e0000000-0000-0000-0000-000000000002', 'Andere Galerie');

insert into public.gallery_members (gallery_id, user_id, role) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'owner'),
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'staff'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'owner');

-- The vehicle catalog comes with the migrations (20261116000001_vehicle_catalog.sql).
