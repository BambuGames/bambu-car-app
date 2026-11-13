-- Staff management (design 9): the gallery-members function adds an address that already has an account
-- without sending a mail. auth.users is not reachable over the API, so the function asks through this one,
-- which only the service role may call (anyone else could probe which addresses have an account).
create function public.admin_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;
revoke execute on function public.admin_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.admin_user_id_by_email(text) to service_role;
