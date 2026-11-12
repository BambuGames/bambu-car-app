-- Credit ledger (design 9): grants, one charge per vehicle, refunds, and who may see or change what.
begin;
select plan(9);

-- As postgres, like the dashboard's SQL editor. Testgalerie: owner d…1, staff d…2; Andere Galerie: owner d…3.
insert into public.vehicles (id, gallery_id, make, model, body_type) values
  ('a1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'VW', 'Golf', 'hatchback');

create temp table balance_before as select public.gallery_credit_balance('e0000000-0000-0000-0000-000000000001') as amount;
select is(
  public.admin_grant_credits('e0000000-0000-0000-0000-000000000001', 5, 'credits-test'), (select amount + 5 from balance_before),
  'admin_grant_credits adds credits and returns the balance'
);
select throws_ok(
  $$select public.admin_refund_vehicle('a1000000-0000-0000-0000-000000000001', 'test')$$,
  'P0001', 'vehicle a1000000-0000-0000-0000-000000000001 was not charged',
  'a vehicle that was never charged cannot be refunded'
);

insert into public.credit_ledger (gallery_id, amount, reason, vehicle_id)
  values ('e0000000-0000-0000-0000-000000000001', -1, 'vehicle', 'a1000000-0000-0000-0000-000000000001');
select throws_ok(
  $$insert into public.credit_ledger (gallery_id, amount, reason, vehicle_id)
    values ('e0000000-0000-0000-0000-000000000001', -1, 'vehicle', 'a1000000-0000-0000-0000-000000000001')$$,
  '23505', null,
  'a vehicle is charged at most once'
);

select public.admin_refund_vehicle('a1000000-0000-0000-0000-000000000001', 'processing failed');
select throws_ok(
  $$select public.admin_refund_vehicle('a1000000-0000-0000-0000-000000000001', 'again')$$,
  '23505', null,
  'a vehicle is refunded at most once'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.credit_ledger
    where vehicle_id = 'a1000000-0000-0000-0000-000000000001' or note = 'credits-test'$$, $$values (3)$$,
  'the owner reads the gallery''s ledger'
);

set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.credit_ledger
    where vehicle_id = 'a1000000-0000-0000-0000-000000000001' or note = 'credits-test'$$, $$values (0)$$,
  'staff do not read the ledger'
);

set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$select public.gallery_credit_balance('e0000000-0000-0000-0000-000000000001')$$,
  '42501', null,
  'another gallery''s balance is not readable'
);
select throws_ok(
  $$select public.admin_grant_credits('e0000000-0000-0000-0000-000000000002', 100, 'self-service')$$,
  '42501', null,
  'signed-in users cannot grant credits'
);
select throws_ok(
  $$insert into public.credit_ledger (gallery_id, amount, reason) values ('e0000000-0000-0000-0000-000000000002', 100, 'grant')$$,
  '42501', null,
  'signed-in users cannot write the ledger'
);

select * from finish();
rollback;
