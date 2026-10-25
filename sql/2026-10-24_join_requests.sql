-- בקשות הצטרפות: דייר עם מייל שלא הוזן מראש שולח בקשה; הוועד מאשר/דוחה.
-- עקרון ההגנה: משתמש ממתין אינו מקבל שורה ב-app_users, ולכן auth_building_id() ריק
-- וכל מדיניות RLS שמבוססת על בניין חוסמת אותו. אין שום דרך לכתוב לטבלה ישירות — רק דרך הפונקציות.

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  auth_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.app_users(id) on delete set null,
  reject_reason text,
  resident_id uuid references public.residents(id),
  apartment_id uuid references public.apartments(id),
  constraint join_requests_auth_unique unique (auth_id),
  constraint join_requests_decided_ck check (
    (status = 'pending' and decided_at is null and decided_by is null)
    or (status = 'approved' and decided_at is not null and decided_by is not null and resident_id is not null)
    or (status = 'rejected' and decided_at is not null and decided_by is not null and length(trim(coalesce(reject_reason,''))) >= 3)
  )
);
create unique index if not exists join_requests_email_uniq on public.join_requests (lower(email));
create index if not exists join_requests_pending_idx on public.join_requests (building_id) where status = 'pending';

alter table public.join_requests enable row level security;
alter table public.join_requests force row level security;
create policy "join_requests read own or committee" on public.join_requests for select to authenticated
  using (auth_id = auth.uid() or (building_id = auth_building_id() and auth_is_admin()));
-- בכוונה אין מדיניות insert/update/delete: הכתיבה רק דרך פונקציות SECURITY DEFINER.
revoke all on public.join_requests from anon, authenticated, public;
grant select on public.join_requests to authenticated;

create trigger trg_no_delete before delete on public.join_requests for each row execute function trg_no_delete();
create trigger trg_audit after insert or update on public.join_requests for each row execute function trg_audit();

-- ---------------------------------------------------------------------------
-- הרשמה: מייל מוכר ← כמו קודם. מייל לא מוכר + קוד בניין תקין ← בקשה בסטטוס pending.
-- זהות ומייל נלקחים מחשבון האימות (auth.users), לא מהלקוח. הפונקציה אידמפוטנטית.
-- ---------------------------------------------------------------------------
create or replace function public.claim_resident_account(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_email text; v_confirmed timestamptz;
  v_res uuid; v_building uuid; v_req join_requests;
begin
  if v_uid is null then return 'no_session'; end if;
  select lower(trim(email)), email_confirmed_at into v_email, v_confirmed from auth.users where id = v_uid;
  if coalesce(v_email,'') = '' then return 'no_session'; end if;
  if exists (select 1 from app_users where auth_id = v_uid) then return 'ok'; end if;
  if v_confirmed is null then return 'email_not_verified'; end if;

  select r.id, a.building_id into v_res, v_building from residents r join apartments a on a.id = r.apartment_id
   where lower(trim(r.email)) = v_email and r.is_active
     and not exists (select 1 from app_users au where au.resident_id = r.id)
   limit 1;

  if v_res is not null then
    if not exists (select 1 from building_secrets s where s.building_id = v_building and s.access_code = trim(p_code)) then return 'bad_code'; end if;
    insert into app_users(auth_id, resident_id, building_id, role) values (v_uid, v_res, v_building, 'resident')
      on conflict (auth_id) do nothing;
    return 'ok';
  end if;

  -- מייל לא מוכר (או דייר מוכר שכבר משויך לחשבון אחר — לא דורסים): בקשת הצטרפות
  select * into v_req from join_requests where auth_id = v_uid;
  if found then
    return case v_req.status when 'pending' then 'pending' when 'rejected' then 'rejected' else 'pending' end;
  end if;
  select s.building_id into v_building from building_secrets s where s.access_code = trim(coalesce(p_code,'')) limit 1;
  if v_building is null then return 'bad_code'; end if;
  insert into join_requests(building_id, auth_id, email) values (v_building, v_uid, v_email)
    on conflict do nothing;
  return 'pending';
end $$;

-- מצב הבקשה של המשתמש עצמו בלבד
create or replace function public.my_join_request()
returns table(status text, requested_at timestamptz, email text)
language sql stable security definer set search_path = public as $$
  select j.status, j.requested_at, j.email from join_requests j where j.auth_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- אישור: פעולה אטומית אחת
-- ---------------------------------------------------------------------------
create or replace function public.approve_join_request(
  p_request uuid, p_apartment uuid, p_full_name text, p_ownership ownership_type,
  p_lives_here boolean, p_link_resident uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u app_users := _require_admin();
  r join_requests; a apartments; res residents; v_res uuid; v_name text := trim(coalesce(p_full_name,''));
begin
  select * into r from join_requests where id = p_request for update;
  if r.id is null or r.building_id <> u.building_id then raise exception 'NOT_FOUND: הבקשה לא נמצאה'; end if;
  if r.status <> 'pending' then raise exception 'ALREADY_DECIDED: הבקשה כבר טופלה'; end if;
  if not exists (select 1 from auth.users where id = r.auth_id and email_confirmed_at is not null) then
    raise exception 'INVALID: המייל של המבקש לא מאומת';
  end if;
  if exists (select 1 from app_users where auth_id = r.auth_id) then raise exception 'CONFLICT: למשתמש כבר יש גישה'; end if;

  select * into a from apartments where id = p_apartment and building_id = u.building_id;
  if a.id is null then raise exception 'INVALID: יש לבחור דירה מהבניין'; end if;

  if p_link_resident is not null then
    select * into res from residents where id = p_link_resident for update;
    if res.id is null or res.apartment_id <> a.id then raise exception 'INVALID: הדייר שנבחר לא שייך לדירה שנבחרה'; end if;
    if not res.is_active then raise exception 'INVALID: הדייר שנבחר אינו פעיל'; end if;
    if exists (select 1 from app_users where resident_id = res.id) then raise exception 'CONFLICT: הדייר כבר משויך לחשבון אחר'; end if;
    if res.email is not null and trim(res.email) <> '' and lower(trim(res.email)) <> lower(r.email) then
      raise exception 'INVALID: המייל ברשימת הדיירים שונה ממייל הבקשה, לא ניתן לקשר';
    end if;
    v_res := res.id; -- פרטי הדייר הקיים לא משתנים
  else
    if length(v_name) < 2 then raise exception 'INVALID: יש להזין שם מלא'; end if;
    if p_ownership is null or p_lives_here is null then raise exception 'INVALID: יש לבחור בעלים/שוכר והאם מתגורר'; end if;
    if exists (select 1 from residents x join apartments ax on ax.id = x.apartment_id
               where ax.building_id = u.building_id and x.is_active and lower(trim(x.email)) = lower(r.email)) then
      raise exception 'DUPLICATE: קיים דייר עם אותו מייל, יש לקשר אותו במקום ליצור חדש';
    end if;
    if exists (select 1 from residents x where x.apartment_id = a.id and x.is_active and lower(regexp_replace(trim(x.full_name),'\s+',' ','g')) = lower(regexp_replace(v_name,'\s+',' ','g'))) then
      raise exception 'DUPLICATE: קיים דייר בשם זה בדירה, יש לקשר אותו במקום ליצור חדש';
    end if;
    perform set_config('app.change_reason', 'אישור בקשת הצטרפות', true);
    insert into residents(apartment_id, full_name, ownership, email, lives_here, is_active, is_primary_contact, is_committee)
    values (a.id, v_name, p_ownership, r.email, p_lives_here, true, false, false) returning id into v_res;
  end if;

  perform set_config('app.change_reason', 'אישור בקשת הצטרפות', true);
  insert into app_users(auth_id, resident_id, building_id, role) values (r.auth_id, v_res, u.building_id, 'resident');
  update join_requests set status = 'approved', decided_at = now(), decided_by = u.id, resident_id = v_res, apartment_id = a.id where id = r.id;
  return jsonb_build_object('status','approved','resident_id', v_res);
end $$;

create or replace function public.reject_join_request(p_request uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); r join_requests;
begin
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'REASON_REQUIRED: יש להזין סיבה'; end if;
  select * into r from join_requests where id = p_request for update;
  if r.id is null or r.building_id <> u.building_id then raise exception 'NOT_FOUND: הבקשה לא נמצאה'; end if;
  if r.status <> 'pending' then raise exception 'ALREADY_DECIDED: הבקשה כבר טופלה'; end if;
  perform set_config('app.change_reason', trim(p_reason), true);
  update join_requests set status = 'rejected', decided_at = now(), decided_by = u.id, reject_reason = trim(p_reason) where id = r.id;
  return jsonb_build_object('status','rejected');
end $$;

revoke all on function public.claim_resident_account(text), public.my_join_request(),
  public.approve_join_request(uuid,uuid,text,ownership_type,boolean,uuid), public.reject_join_request(uuid,text) from public, anon;
grant execute on function public.claim_resident_account(text), public.my_join_request(),
  public.approve_join_request(uuid,uuid,text,ownership_type,boolean,uuid), public.reject_join_request(uuid,text) to authenticated;
