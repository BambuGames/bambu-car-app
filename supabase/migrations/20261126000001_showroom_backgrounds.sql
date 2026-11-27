-- Showroom backgrounds (design 2026-11-26): a room the worker draws for each photo from its slot's template
-- camera. spec {"kind":"showroom","wall","ceiling","floor","grout","gloss"}; the worker must know this kind
-- before these rows exist (deploy order: worker, app, then this migration).
insert into public.backgrounds (id, name, spec, sort_order) values
  ('b0000000-0000-0000-0000-000000000004', 'Showroom Weiß',
   '{"kind":"showroom","wall":"#F0F1F1","ceiling":"#F6F7F7","floor":"#44474B","grout":"#2B2D30","gloss":0.55}', 4),
  ('b0000000-0000-0000-0000-000000000005', 'Showroom Anthrazit',
   '{"kind":"showroom","wall":"#474B50","ceiling":"#55595E","floor":"#2C2F32","grout":"#1E2022","gloss":0.45}', 5);
