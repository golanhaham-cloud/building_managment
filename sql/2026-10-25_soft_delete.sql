-- מחיקה רכה (ניתנת לשחזור) להודעות ועד ולתקלות/פניות.
-- עקרונות: אין מחיקה פיזית (טריגר חוסם); פריט שנמחק מוסתר ע"י RLS מכל המשתמשים, כולל הוועד, בכל שאילתה רגילה;
-- הוועד רואה אותו רק דרך list_deleted_items(); שינוי deleted_at/deleted_by אפשרי רק דרך הפונקציות שלמטה.

alter table public.announcements add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references public.app_users(id) on delete set null;
alter table public.requests      add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references public.app_users(id) on delete set null;
create index if not exists announcements_deleted_idx on public.announcements (building_id) where deleted_at is not null;
create index if not exists requests_deleted_idx on public.requests (building_id) where deleted_at is not null;

-- שמירה: רק הפונקציות (שמסמנות app.soft_delete) יכולות לשנות את שדות המחיקה
create or replace function public.trg_guard_deleted() returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.deleted_at is not null or NEW.deleted_by is not null then raise exception 'FORBIDDEN: לא ניתן ליצור פריט מחוק' using errcode='42501'; end if;
  elsif (NEW.deleted_at, NEW.deleted_by) is distinct from (OLD.deleted_at, OLD.deleted_by)
        and coalesce(current_setting('app.soft_delete', true), '') <> 'on' then
    raise exception 'FORBIDDEN: מחיקה ושחזור מתבצעים רק דרך הפעולה המיועדת' using errcode='42501';
  end if;
  return NEW;
end $$;

create trigger trg_guard_deleted before insert or update on public.announcements for each row execute function public.trg_guard_deleted();
create trigger trg_guard_deleted before insert or update on public.requests for each row execute function public.trg_guard_deleted();
create trigger trg_no_delete before delete on public.announcements for each row execute function public.trg_no_delete();
create trigger trg_no_delete before delete on public.requests for each row execute function public.trg_no_delete();

-- מדיניות: פריט מחוק מוסתר מכולם. (alter policy: ללא מחיקת מדיניות)
alter policy "announcements read" on public.announcements using (building_id = auth_building_id() and deleted_at is null);
alter policy "announcements write admin" on public.announcements using (building_id = auth_building_id() and auth_is_admin() and deleted_at is null);
alter policy "requests read" on public.requests using (building_id = auth_building_id() and deleted_at is null);
alter policy "requests update admin" on public.requests using (building_id = auth_building_id() and auth_is_admin() and deleted_at is null);
alter policy "requests delete admin" on public.requests using (false);
alter policy "attachments read" on public.request_attachments using (
  building_id = auth_building_id()
  and exists (select 1 from public.requests r where r.id = request_attachments.request_id and r.building_id = auth_building_id() and r.deleted_at is null));

-- צירוף קבצים לפנייה מחוקה נחסם
create or replace function public.register_request_attachment(p_request uuid, p_path text, p_name text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth_app_user_id(); bid uuid := auth_building_id(); r requests; o record; n int; new_id uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED: יש להתחבר' using errcode='42501'; end if;
  select * into r from requests where id = p_request and building_id = bid and deleted_at is null;
  if not found then raise exception 'NOT_FOUND: הפנייה לא נמצאה'; end if;
  if not (auth_is_admin() or r.opened_by = uid) then raise exception 'FORBIDDEN: רק פותח/ת הפנייה או הוועד יכולים לצרף קבצים' using errcode='42501'; end if;
  if p_path not like bid::text || '/' || p_request::text || '/%' then raise exception 'INVALID: נתיב קובץ לא תקין'; end if;
  select id, metadata into o from storage.objects where bucket_id = 'request-files' and name = p_path;
  if not found then raise exception 'INVALID: הקובץ לא נמצא באחסון'; end if;
  select count(*) into n from request_attachments where request_id = p_request and removed_at is null;
  if n >= 10 then raise exception 'LIMIT: ניתן לצרף עד 10 קבצים לפנייה'; end if;
  insert into request_attachments(building_id, request_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
  values (bid, p_request, p_path, left(coalesce(nullif(trim(p_name),''),'file'),200),
          coalesce(o.metadata->>'mimetype','application/octet-stream'), greatest(coalesce((o.metadata->>'size')::bigint,1),1), uid)
  returning id into new_id;
  return jsonb_build_object('status','saved','id',new_id);
end $$;

-- מחיקה: הודעה — ועד בלבד. תקלה — ועד (כל תקלה בבניין) או הדייר שפתח אותה.
create or replace function public.soft_delete_item(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth_app_user_id(); bid uuid := auth_building_id(); n int;
begin
  if uid is null or bid is null then raise exception 'NOT_AUTHENTICATED: יש להתחבר' using errcode='42501'; end if;
  perform set_config('app.soft_delete', 'on', true);
  perform set_config('app.change_reason', 'מחיקה (ניתנת לשחזור)', true);
  if p_kind = 'announcement' then
    if not auth_is_admin() then raise exception 'FORBIDDEN: רק הוועד יכול למחוק הודעה' using errcode='42501'; end if;
    update announcements set deleted_at = now(), deleted_by = uid where id = p_id and building_id = bid and deleted_at is null;
  elsif p_kind = 'request' then
    update requests set deleted_at = now(), deleted_by = uid
     where id = p_id and building_id = bid and deleted_at is null and (auth_is_admin() or opened_by = uid);
  else
    raise exception 'INVALID: סוג פריט לא תקין';
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    -- לא מגלים אם הפריט קיים אצל מישהו אחר
    raise exception 'NOT_FOUND: הפריט לא נמצא או שאין לך הרשאה למחוק אותו' using errcode='42501';
  end if;
  return jsonb_build_object('status','deleted');
end $$;

create or replace function public.restore_item(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); n int;
begin
  perform set_config('app.soft_delete', 'on', true);
  perform set_config('app.change_reason', 'שחזור מחיקה', true);
  if p_kind = 'announcement' then
    update announcements set deleted_at = null, deleted_by = null where id = p_id and building_id = u.building_id and deleted_at is not null;
  elsif p_kind = 'request' then
    update requests set deleted_at = null, deleted_by = null where id = p_id and building_id = u.building_id and deleted_at is not null;
  else
    raise exception 'INVALID: סוג פריט לא תקין';
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOT_FOUND: הפריט לא נמצא ברשימת הנמחקים'; end if;
  return jsonb_build_object('status','restored');
end $$;

-- תצוגת "נמחקו": ועד בלבד, בניין שלו בלבד
create or replace function public.list_deleted_items()
returns table(kind text, id uuid, title text, body text, status text, urgency text, is_important boolean,
              created_at timestamptz, deleted_at timestamptz, deleted_by_name text, attachments int)
language plpgsql stable security definer set search_path = public as $$
declare u app_users := _require_admin();
begin
  return query
    select 'announcement'::text, a.id, a.title, a.body, null::text, null::text, a.is_important, a.created_at, a.deleted_at,
           (select r.full_name from app_users au left join residents r on r.id = au.resident_id where au.id = a.deleted_by), 0
      from announcements a where a.building_id = u.building_id and a.deleted_at is not null
    union all
    select 'request'::text, q.id, q.title, q.description, q.status::text, q.urgency, null::boolean, q.created_at, q.deleted_at,
           (select r.full_name from app_users au left join residents r on r.id = au.resident_id where au.id = q.deleted_by),
           (select count(*)::int from request_attachments x where x.request_id = q.id and x.removed_at is null)
      from requests q where q.building_id = u.building_id and q.deleted_at is not null
    order by 9 desc;
end $$;

revoke all on function public.soft_delete_item(text,uuid), public.restore_item(text,uuid), public.list_deleted_items(),
  public.register_request_attachment(uuid,text,text), public.trg_guard_deleted() from public, anon;
grant execute on function public.soft_delete_item(text,uuid), public.restore_item(text,uuid), public.list_deleted_items(),
  public.register_request_attachment(uuid,text,text) to authenticated;
