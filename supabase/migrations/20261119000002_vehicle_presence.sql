-- Presence on the private channel `vehicle:{id}`: "this vehicle is open on another device".
-- Only members of the vehicle's gallery may join (select) and announce themselves (insert).
-- Realtime probes the policy with its own test row, so there is no extension condition here;
-- the channel is only used for presence.
create function private.can_join_vehicle_channel(topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select topic ~ '^vehicle:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1 from public.vehicles v
      where v.id = substr(topic, 9)::uuid and private.is_gallery_member(v.gallery_id)
    )
$$;
revoke execute on function private.can_join_vehicle_channel(text) from public;
grant execute on function private.can_join_vehicle_channel(text) to authenticated;

create policy vehicle_presence_select on realtime.messages for select to authenticated
  using (private.can_join_vehicle_channel((select realtime.topic())));
create policy vehicle_presence_insert on realtime.messages for insert to authenticated
  with check (private.can_join_vehicle_channel((select realtime.topic())));
