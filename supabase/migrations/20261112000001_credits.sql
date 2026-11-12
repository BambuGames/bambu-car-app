-- Credit ledger (design 9): 1 credit = 1 vehicle. Bambu Games grants credits and refunds failed vehicles
-- from the SQL editor; processing charges a vehicle once (start_processing, next migration).
-- The balance is the sum of the ledger.

create type public.credit_reason as enum ('grant', 'vehicle', 'refund');

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  gallery_id uuid not null references public.galleries on delete cascade,
  amount int not null,
  reason public.credit_reason not null,
  vehicle_id uuid references public.vehicles,
  created_by uuid default auth.uid() references auth.users on delete set null,
  note text,
  created_at timestamptz not null default now(),
  check (
    (reason = 'grant' and amount > 0)
    or (reason = 'vehicle' and amount = -1 and vehicle_id is not null)
    or (reason = 'refund' and amount = 1 and vehicle_id is not null)
  )
);
create index credit_ledger_gallery_id_idx on public.credit_ledger (gallery_id);
-- One charge and at most one refund per vehicle, whatever the app or two devices do.
create unique index credit_ledger_vehicle_once on public.credit_ledger (vehicle_id) where reason = 'vehicle';
create unique index credit_ledger_refund_once on public.credit_ledger (vehicle_id) where reason = 'refund';

alter table public.credit_ledger enable row level security;
-- The gallery manager sees balance and history (design 9). Rows are written only by functions.
create policy "owners read their gallery's ledger" on public.credit_ledger
  for select to authenticated using (private.is_gallery_owner(gallery_id));
revoke insert, update, delete on public.credit_ledger from anon, authenticated;

create function public.gallery_credit_balance(p_gallery_id uuid) returns int
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'authenticated' and not private.is_gallery_member(p_gallery_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return coalesce((select sum(amount) from public.credit_ledger where gallery_id = p_gallery_id), 0);
end
$$;
revoke execute on function public.gallery_credit_balance(uuid) from public, anon;
grant execute on function public.gallery_credit_balance(uuid) to authenticated;

create function public.admin_grant_credits(p_gallery_id uuid, p_amount int, p_note text) returns int
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.credit_ledger (gallery_id, amount, reason, note, created_by)
    values (p_gallery_id, p_amount, 'grant', p_note, null);
  return public.gallery_credit_balance(p_gallery_id);
end
$$;

-- For a vehicle whose processing failed completely (design 9): gives its credit back once.
create function public.admin_refund_vehicle(p_vehicle_id uuid, p_note text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_gallery uuid;
begin
  select gallery_id into v_gallery from public.credit_ledger where vehicle_id = p_vehicle_id and reason = 'vehicle';
  if v_gallery is null then
    raise exception 'vehicle % was not charged', p_vehicle_id;
  end if;
  insert into public.credit_ledger (gallery_id, amount, reason, vehicle_id, note, created_by)
    values (v_gallery, 1, 'refund', p_vehicle_id, p_note, null);
  return public.gallery_credit_balance(v_gallery);
end
$$;

revoke execute on function public.admin_grant_credits(uuid, int, text),
  public.admin_refund_vehicle(uuid, text) from public, anon, authenticated;
