-- Already applied to the live project (migration "resident_contact_lookup"). Kept here for the record.
-- Additive: get_resident_directory is untouched. Contacts are served per resident, on demand,
-- only to a signed-in user of the same building (checked inside the function itself).
create or replace function public.get_resident_contact(p_resident uuid)
returns table(full_name text, phone text, email text)
language sql stable security definer set search_path = public as $$
  select r.full_name, nullif(trim(r.phone), ''), nullif(trim(r.email), '')
  from residents r
  join apartments a on a.id = r.apartment_id
  where r.id = p_resident
    and r.is_active
    and auth_app_user_id() is not null
    and a.building_id = auth_building_id()
$$;
revoke all on function public.get_resident_contact(uuid) from public, anon;
grant execute on function public.get_resident_contact(uuid) to authenticated;
