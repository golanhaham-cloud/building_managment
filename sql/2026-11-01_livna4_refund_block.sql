-- 2026-11-01 · חסימת שיוך החזרי ליבנה 4 לדירות גם ברמת מסד הנתונים.
-- אותו כלל כמו בקוד המשותף (src/lib/income-classes.ts): "העברה מאת: ועד בית ליבנה 4 ..." בראש התיאור,
-- בלי סיווג מפורש של תשלום דייר (דירת מקור או קטגוריית "ועד בית"). לא מזהים לפי הספרה 4 לבדה.
-- אין שינוי נתונים, אין שינוי סכימה: רק דחייה של שיוך חדש להחזר. שיוכים קיימים אינם משתנים.

create or replace function public._is_livna4_refund(p_description text, p_source_apartment_id uuid, p_category_name text)
returns boolean language plpgsql immutable as $$
declare d text := trim(regexp_replace(coalesce(p_description, ''), '\s+', ' ', 'g'));
begin
  if d ~ '^(העברה מאת:\s*)?ועד\s+(ה)?בית\s+ליבנה\s*4($|[^0-9])' then
    -- סיווג מפורש של תשלום דייר גובר: לא חוסמים, מסמנים לבדיקה במסכים.
    if p_source_apartment_id is not null or coalesce(p_category_name, '') = 'ועד בית' then return false; end if;
    return true;
  end if;
  return false;
end $$;

create or replace function public.allocate_income(p_tx uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); n int;
begin
  if not exists (select 1 from transactions where id = p_tx and building_id = u.building_id) then raise exception 'NOT_FOUND: ההכנסה לא נמצאה'; end if;
  if exists (
    select 1 from transactions t left join categories c on c.id = t.category_id
     where t.id = p_tx and t.building_id = u.building_id
       and public._is_livna4_refund(t.description, t.source_apartment_id, c.name)
  ) then
    raise exception 'LIVNA4_REFUND: החזר מליבנה 4 הוא הכנסה של הבניין ולא תשלום דייר, ולכן לא ניתן לשייך אותו לדירה ולחודשים';
  end if;
  perform set_config('app.change_reason', 'שיוך הכנסה קיימת', true);
  n := _insert_allocations(p_tx, p_items);
  return jsonb_build_object('status','allocated','count',n);
end $$;

create or replace function public.record_income_with_allocations(
  p_date date, p_amount numeric, p_description text, p_method text, p_notes text, p_key uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); v_id uuid; n int;
begin
  if p_key is not null then
    select id into v_id from transactions where idempotency_key = p_key;
    if v_id is not null then return jsonb_build_object('status','duplicate','id',v_id); end if;
  end if;
  if p_date is null then raise exception 'INVALID: חסר תאריך'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID: הסכום חייב להיות חיובי'; end if;
  -- הכנסה חדשה עם שיוכים מיועדת לתשלומי דיירים: החזר מליבנה 4 נרשם כהכנסה רגילה בכספים, לא כאן.
  if public._is_livna4_refund(p_description, null, null) then
    raise exception 'LIVNA4_REFUND: החזר מליבנה 4 הוא הכנסה של הבניין ולא תשלום דייר, ולכן לא ניתן לשייך אותו לדירה ולחודשים';
  end if;
  insert into transactions(building_id, type, date, amount, description, payment_method, notes, entered_by, idempotency_key)
  values (u.building_id, 'income', p_date, p_amount, nullif(trim(p_description),''), p_method, nullif(trim(p_notes),''), u.id, p_key)
  returning id into v_id;
  perform set_config('app.change_reason', 'שיוך תשלום חדש', true);
  n := _insert_allocations(v_id, p_items);
  return jsonb_build_object('status','created','id',v_id,'count',n);
end $$;

revoke execute on function public._is_livna4_refund(text, uuid, text) from public, anon;
revoke execute on function public.allocate_income(uuid, jsonb) from public, anon;
revoke execute on function public.record_income_with_allocations(date, numeric, text, text, text, uuid, jsonb) from public, anon;
