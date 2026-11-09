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

-- Vehicle catalog: makes common in Germany, spelled as on mobile.de, with their usual models.
with catalog (make, models) as (values
  ('Alfa Romeo', array['Giulia', 'Giulietta', 'Junior', 'MiTo', 'Stelvio', 'Tonale']),
  ('Audi', array['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'e-tron GT', 'Q2', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'TT']),
  ('BMW', array['1er', '2er', '3er', '4er', '5er', '7er', 'i4', 'iX', 'iX1', 'X1', 'X2', 'X3', 'X5', 'X6', 'Z4']),
  ('BYD', array['Atto 3', 'Dolphin', 'Han', 'Seal', 'Seal U', 'Tang']),
  ('Citroën', array['Berlingo', 'C3', 'C3 Aircross', 'C4', 'C5 Aircross', 'C5 X', 'SpaceTourer']),
  ('Cupra', array['Ateca', 'Born', 'Formentor', 'Leon', 'Tavascan', 'Terramar']),
  ('Dacia', array['Bigster', 'Duster', 'Jogger', 'Logan', 'Sandero', 'Spring']),
  ('DS Automobiles', array['DS 3', 'DS 4', 'DS 7', 'DS 9']),
  ('Fiat', array['500', '500e', '500X', '600', 'Doblo', 'Ducato', 'Panda', 'Tipo']),
  ('Ford', array['Explorer', 'Fiesta', 'Focus', 'Galaxy', 'Kuga', 'Mondeo', 'Mustang', 'Mustang Mach-E', 'Puma', 'Ranger', 'S-Max', 'Tourneo Connect', 'Transit']),
  ('Honda', array['Civic', 'CR-V', 'e:Ny1', 'HR-V', 'Jazz', 'ZR-V']),
  ('Hyundai', array['Bayon', 'i10', 'i20', 'i30', 'IONIQ 5', 'IONIQ 6', 'Kona', 'Santa Fe', 'Tucson']),
  ('Jeep', array['Avenger', 'Compass', 'Grand Cherokee', 'Renegade', 'Wrangler']),
  ('Kia', array['Ceed', 'EV6', 'EV9', 'Niro', 'Picanto', 'Rio', 'Sorento', 'Sportage', 'Stonic', 'XCeed']),
  ('Land Rover', array['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar']),
  ('Mazda', array['CX-30', 'CX-5', 'CX-60', 'Mazda2', 'Mazda3', 'Mazda6', 'MX-30', 'MX-5']),
  ('Mercedes-Benz', array['A-Klasse', 'B-Klasse', 'C-Klasse', 'CLA', 'E-Klasse', 'EQA', 'EQE', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'S-Klasse', 'V-Klasse', 'Vito']),
  ('MG', array['Cyberster', 'HS', 'Marvel R', 'MG4', 'MG5', 'ZS']),
  ('MINI', array['Aceman', 'Cabrio', 'Clubman', 'Cooper', 'Countryman']),
  ('Mitsubishi', array['ASX', 'Colt', 'Eclipse Cross', 'L200', 'Outlander', 'Space Star']),
  ('Nissan', array['Ariya', 'Juke', 'Leaf', 'Micra', 'Navara', 'Qashqai', 'X-Trail']),
  ('Opel', array['Astra', 'Combo', 'Corsa', 'Crossland', 'Frontera', 'Grandland', 'Insignia', 'Mokka', 'Vivaro', 'Zafira']),
  ('Peugeot', array['108', '208', '2008', '308', '3008', '408', '508', '5008', 'Partner', 'Rifter']),
  ('Polestar', array['Polestar 2', 'Polestar 3', 'Polestar 4']),
  ('Porsche', array['718 Boxster', '718 Cayman', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan']),
  ('Renault', array['Arkana', 'Austral', 'Captur', 'Clio', 'Espace', 'Kangoo', 'Mégane', 'Rafale', 'Scenic', 'Twingo', 'Zoe']),
  ('Seat', array['Alhambra', 'Arona', 'Ateca', 'Ibiza', 'Leon', 'Tarraco']),
  ('Skoda', array['Elroq', 'Enyaq', 'Fabia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Scala', 'Superb']),
  ('smart', array['#1', '#3', 'forfour', 'fortwo']),
  ('Subaru', array['Crosstrek', 'Forester', 'Impreza', 'Outback', 'Solterra', 'XV']),
  ('Suzuki', array['Across', 'Ignis', 'Jimny', 'S-Cross', 'Swift', 'Vitara']),
  ('Tesla', array['Model 3', 'Model S', 'Model X', 'Model Y']),
  ('Toyota', array['Aygo X', 'bZ4X', 'C-HR', 'Camry', 'Corolla', 'Corolla Cross', 'GR86', 'Hilux', 'Land Cruiser', 'Prius', 'Proace', 'RAV4', 'Yaris', 'Yaris Cross']),
  ('Volkswagen', array['Caddy', 'Golf', 'ID. Buzz', 'ID.3', 'ID.4', 'ID.5', 'ID.7', 'Multivan', 'Passat', 'Polo', 'T-Cross', 'T-Roc', 'Tiguan', 'Touareg', 'Touran']),
  ('Volvo', array['C40', 'EX30', 'EX90', 'S60', 'S90', 'V40', 'V60', 'V90', 'XC40', 'XC60', 'XC90'])
),
inserted as (
  insert into public.makes (name) select make from catalog returning id, name
)
insert into public.models (make_id, name)
select inserted.id, unnest(catalog.models) from inserted join catalog on catalog.make = inserted.name;
