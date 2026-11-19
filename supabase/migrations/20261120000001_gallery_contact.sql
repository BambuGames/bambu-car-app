-- Gallery contact numbers for the sales poster. Written by the owner through the existing
-- "owners update their gallery" policy, read by members through "members read their gallery".
alter table public.galleries
  add column phone text check (phone is null or char_length(phone) between 1 and 30),
  add column whatsapp text check (whatsapp is null or char_length(whatsapp) between 1 and 30);
