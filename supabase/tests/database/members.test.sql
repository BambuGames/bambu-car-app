-- gallery-members looks accounts up by email through admin_user_id_by_email; nobody else may, or the API
-- would tell anyone which addresses have an account.
begin;
select plan(3);

select is(public.admin_user_id_by_email(' Staff@Bambu.Test '), 'd0000000-0000-0000-0000-000000000002'::uuid,
  'an account is found by its address, whatever the case and spaces');
select is(public.admin_user_id_by_email('niemand@bambu.test'), null, 'an unknown address finds nothing');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select public.admin_user_id_by_email('staff@bambu.test')$$, '42501', null,
  'signed-in users cannot look accounts up');

select * from finish();
rollback;
