-- Admin functions for Bambu Games, run from the dashboard's SQL editor.
-- Invite the person first (Authentication → Invite user), then attach them to a gallery here.

create function public.admin_create_gallery(p_name text, p_owner_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_gallery uuid;
begin
  select id into v_user from auth.users where email = lower(p_owner_email);
  if v_user is null then
    raise exception 'no user with email %; invite the user first', p_owner_email;
  end if;
  insert into public.galleries (name) values (p_name) returning id into v_gallery;
  insert into public.gallery_members (gallery_id, user_id, role) values (v_gallery, v_user, 'owner');
  return v_gallery;
end
$$;

create function public.admin_add_member(p_gallery_id uuid, p_email text, p_role public.member_role) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where email = lower(p_email);
  if v_user is null then
    raise exception 'no user with email %; invite the user first', p_email;
  end if;
  insert into public.gallery_members (gallery_id, user_id, role) values (p_gallery_id, v_user, p_role)
  on conflict (gallery_id, user_id) do update set role = excluded.role;
end
$$;

-- Supabase grants execute on new public functions to anon and authenticated by default.
revoke execute on function public.admin_create_gallery(text, text),
  public.admin_add_member(uuid, text, public.member_role) from public, anon, authenticated;
