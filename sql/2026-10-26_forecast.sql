-- עמוד "הוצאות קבועות ותחזית": נתונים והנחות בלבד. אין כאן תנועות, חיובים, תשלומים או יתרות.
-- צפייה: כל משתמש מחובר עם שיוך לבניין (RLS לפי הבניין). כתיבה: רק דרך הפונקציות, ורק לוועד.

create table if not exists public.forecast_items (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  name text not null check (length(trim(name)) between 1 and 120),
  supplier text check (supplier is null or length(supplier) <= 120),
  monthly_estimate numeric(12,2) not null check (monthly_estimate >= 0 and monthly_estimate < 10000000),
  kind text not null default 'recurring' check (kind in ('recurring','allocation')),
  basis text not null check (length(trim(basis)) between 3 and 500),
  last_payment_amount numeric(12,2) check (last_payment_amount is null or last_payment_amount >= 0),
  last_payment_date date,
  notes text check (notes is null or length(notes) <= 500),
  is_active boolean not null default true,
  stopped_at timestamptz,
  stop_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references public.app_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id) on delete set null,
  row_version bigint not null default 1
);
create table if not exists public.forecast_settings (
  building_id uuid primary key references public.buildings(id),
  libna4_refund numeric(12,2) not null default 0 check (libna4_refund >= 0 and libna4_refund < 10000000),
  refund_basis text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id) on delete set null,
  row_version bigint not null default 1
);
create table if not exists public.forecast_scenarios (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  fee_amount numeric(12,2) not null check (fee_amount > 0),
  non_paying int not null default 0 check (non_paying between 0 and 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id) on delete set null,
  unique (building_id, fee_amount)
);
create table if not exists public.forecast_one_offs (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  year int not null check (year between 2024 and 2100),
  month int not null check (month between 1 and 12),
  title text not null check (length(trim(title)) between 1 and 120),
  amount numeric(12,2) not null check (amount > 0 and amount < 10000000),
  note text check (note is null or length(note) <= 500),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references public.app_users(id) on delete set null
);
create index if not exists forecast_one_offs_month_idx on public.forecast_one_offs (building_id, year, month);

do $$ declare t text; begin
  foreach t in array array['forecast_items','forecast_settings','forecast_scenarios','forecast_one_offs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy "%s read building" on public.%I for select to authenticated using (building_id = auth_building_id())', t, t);
    execute format('revoke all on public.%I from anon, authenticated, public', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create trigger trg_no_delete before delete on public.%I for each row execute function trg_no_delete()', t);
    execute format('create trigger trg_audit after insert or update on public.%I for each row execute function trg_audit()', t);
  end loop;
end $$;
create trigger trg_row_version before update on public.forecast_items for each row execute function trg_row_version();
create trigger trg_row_version before update on public.forecast_settings for each row execute function trg_row_version();

-- ---------------------------------------------------------------- writes (committee only)
create or replace function public.forecast_save_item(
  p_id uuid, p_name text, p_supplier text, p_amount numeric, p_kind text, p_basis text,
  p_last_amount numeric, p_last_date date, p_notes text, p_version bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); v_id uuid;
begin
  if length(trim(coalesce(p_name,''))) = 0 then raise exception 'INVALID: יש להזין שם סעיף'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'INVALID: אומדן חודשי לא תקין'; end if;
  if p_kind not in ('recurring','allocation') then raise exception 'INVALID: סוג סעיף לא תקין'; end if;
  if length(trim(coalesce(p_basis,''))) < 3 then raise exception 'INVALID: יש להזין את בסיס החישוב'; end if;
  perform set_config('app.change_reason', 'עדכון הוצאות קבועות ותחזית', true);
  if p_id is null then
    insert into forecast_items(building_id, name, supplier, monthly_estimate, kind, basis, last_payment_amount, last_payment_date, notes, created_by, updated_by)
    values (u.building_id, trim(p_name), nullif(trim(coalesce(p_supplier,'')),''), p_amount, p_kind, trim(p_basis), p_last_amount, p_last_date, nullif(trim(coalesce(p_notes,'')),''), u.id, u.id)
    returning id into v_id;
  else
    update forecast_items set name = trim(p_name), supplier = nullif(trim(coalesce(p_supplier,'')),''), monthly_estimate = p_amount, kind = p_kind,
           basis = trim(p_basis), last_payment_amount = p_last_amount, last_payment_date = p_last_date, notes = nullif(trim(coalesce(p_notes,'')),''),
           updated_at = now(), updated_by = u.id, row_version = p_version
     where id = p_id and building_id = u.building_id returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND: הסעיף לא נמצא'; end if;
  end if;
  return jsonb_build_object('status','saved','id',v_id);
end $$;

create or replace function public.forecast_set_item_active(p_id uuid, p_active boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); n int;
begin
  if not p_active and length(trim(coalesce(p_reason,''))) < 3 then raise exception 'REASON_REQUIRED: יש להזין סיבה להפסקת הסעיף'; end if;
  perform set_config('app.change_reason', case when p_active then 'החזרת סעיף לתחזית' else trim(p_reason) end, true);
  update forecast_items set is_active = p_active, stopped_at = case when p_active then null else now() end,
         stop_reason = case when p_active then null else trim(p_reason) end, updated_at = now(), updated_by = u.id
   where id = p_id and building_id = u.building_id and is_active is distinct from p_active;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOT_FOUND: הסעיף לא נמצא או שכבר במצב המבוקש'; end if;
  return jsonb_build_object('status','ok');
end $$;

create or replace function public.forecast_save_settings(p_refund numeric, p_basis text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin();
begin
  if p_refund is null or p_refund < 0 then raise exception 'INVALID: סכום החזר לא תקין'; end if;
  perform set_config('app.change_reason', 'עדכון הנחת החזר ליבנה 4', true);
  insert into forecast_settings(building_id, libna4_refund, refund_basis, updated_by) values (u.building_id, p_refund, trim(coalesce(p_basis,'')), u.id)
  on conflict (building_id) do update set libna4_refund = excluded.libna4_refund, refund_basis = excluded.refund_basis, updated_at = now(), updated_by = u.id,
         row_version = forecast_settings.row_version;
  return jsonb_build_object('status','saved');
end $$;

create or replace function public.forecast_set_scenario(p_fee_amount numeric, p_non_paying int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin();
begin
  if p_fee_amount is null or p_fee_amount <= 0 then raise exception 'INVALID: קבוצת תעריף לא תקינה'; end if;
  if p_non_paying is null or p_non_paying < 0 or p_non_paying > 200 then raise exception 'INVALID: מספר דירות לא תקין'; end if;
  perform set_config('app.change_reason', 'עדכון תרחיש היפותטי', true);
  insert into forecast_scenarios(building_id, fee_amount, non_paying, updated_by) values (u.building_id, p_fee_amount, p_non_paying, u.id)
  on conflict (building_id, fee_amount) do update set non_paying = excluded.non_paying, updated_at = now(), updated_by = u.id;
  return jsonb_build_object('status','saved');
end $$;

create or replace function public.forecast_add_one_off(p_year int, p_month int, p_title text, p_amount numeric, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); v_id uuid;
begin
  if p_year is null or p_year not between 2024 and 2100 or p_month is null or p_month not between 1 and 12 then raise exception 'INVALID: חודש לא תקין'; end if;
  if length(trim(coalesce(p_title,''))) = 0 then raise exception 'INVALID: יש להזין תיאור'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID: סכום לא תקין'; end if;
  perform set_config('app.change_reason', 'הוספת הוצאה צפויה מיוחדת', true);
  insert into forecast_one_offs(building_id, year, month, title, amount, note, created_by)
  values (u.building_id, p_year, p_month, trim(p_title), p_amount, nullif(trim(coalesce(p_note,'')),''), u.id) returning id into v_id;
  return jsonb_build_object('status','saved','id',v_id);
end $$;

create or replace function public.forecast_void_one_off(p_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); n int;
begin
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'REASON_REQUIRED: יש להזין סיבה'; end if;
  perform set_config('app.change_reason', trim(p_reason), true);
  update forecast_one_offs set voided_at = now(), void_reason = trim(p_reason) where id = p_id and building_id = u.building_id and voided_at is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOT_FOUND: ההוצאה לא נמצאה'; end if;
  return jsonb_build_object('status','voided');
end $$;

-- קבוצות תעריף לחודש: לפי התעריף התקף הקיים (effective_fee), מצטבר בלבד - ללא זיהוי דירות. פתוח לכל משתמש מחובר בבניין.
create or replace function public.forecast_fee_groups(p_year int, p_month int)
returns table(fee_amount numeric, apartment_count int)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth_building_id() is null then raise exception 'NOT_AUTHENTICATED: יש להתחבר' using errcode='42501'; end if;
  if p_year is null or p_year not between 2024 and 2100 or p_month is null or p_month not between 1 and 12 then raise exception 'INVALID: חודש לא תקין'; end if;
  return query
    select effective_fee(a.id, p_year, p_month), count(*)::int
      from apartments a where a.building_id = auth_building_id()
     group by 1 order by 1 nulls first;
end $$;

revoke all on function public.forecast_save_item(uuid,text,text,numeric,text,text,numeric,date,text,bigint), public.forecast_set_item_active(uuid,boolean,text),
  public.forecast_save_settings(numeric,text), public.forecast_set_scenario(numeric,int), public.forecast_add_one_off(int,int,text,numeric,text),
  public.forecast_void_one_off(uuid,text), public.forecast_fee_groups(int,int) from public, anon;
grant execute on function public.forecast_save_item(uuid,text,text,numeric,text,text,numeric,date,text,bigint), public.forecast_set_item_active(uuid,boolean,text),
  public.forecast_save_settings(numeric,text), public.forecast_set_scenario(numeric,int), public.forecast_add_one_off(int,int,text,numeric,text),
  public.forecast_void_one_off(uuid,text), public.forecast_fee_groups(int,int) to authenticated;

-- ---------------------------------------------------------------- נתוני פתיחה (לפי דפי הבנק 1.12.2024-16.10.2026)
insert into forecast_items(building_id, name, supplier, monthly_estimate, kind, basis, last_payment_amount, last_payment_date, notes)
select b.id, v.name, v.supplier, v.amt, v.kind, v.basis, v.la, v.ld, v.notes from (select id from buildings order by created_at limit 1) b,
(values
 ('תחזוקת מעלית','קונה',2011.00,'recurring','אומדן חודשי לפי דפי הבנק 1.12.2024–16.10.2026',null::numeric,date '2026-09-30',null::text),
 ('ניקיון','גילי מלכה',1400.00,'recurring','אומדן חודשי לפי דפי הבנק 1.12.2024–16.10.2026',null,date '2026-10-12',null),
 ('חשמל הבניין',null,932.00,'recurring','ממוצע ארבעה חשבונות דו־חודשיים אחרונים, כ־1,864 לחשבון, חלקי 2',1805.51,date '2026-09-10','חשבון אחרון 1,805.51'),
 ('חשמל חניון','אייץ בי פיטרו',276.00,'recurring','אומדן לפי תשלומים בסך 6,078.15 לאורך 22 חודשים',1038.48,date '2026-08-17',null),
 ('פרטנר',null,146.24,'recurring','אומדן חודשי לפי דפי הבנק 1.12.2024–16.10.2026',null,null,null),
 ('ביטוח הפניקס',null,163.00,'recurring','אומדן חודשי לפי דפי הבנק 1.12.2024–16.10.2026',null,null,null),
 ('בזק',null,24.57,'recurring','אומדן חודשי לפי דפי הבנק 1.12.2024–16.10.2026',null,null,null),
 ('עמלות בנק',null,33.00,'recurring','אומדן לפי התשלום האחרון',null,null,null),
 ('הדברה','אבי בראון',46.00,'allocation','הקצאה חודשית משוערת, לא חיוב חודשי. שני תשלומים בהפרש של כשנה',550.00,date '2026-07-22',null),
 ('בדיקת מעלית','נחום',29.00,'allocation','הקצאה חודשית משוערת לפי קצב שלוש הבדיקות שנצפו בדוח, לא חיוב חודשי',220.00,date '2026-07-15',null)
) as v(name, supplier, amt, kind, basis, la, ld, notes)
where not exists (select 1 from forecast_items);

insert into forecast_settings(building_id, libna4_refund, refund_basis)
select b.id, 222.00, 'ממוצע תקבולים בדצמבר 2024–ספטמבר 2026, ללא סגירת חוב ישן. זהו החזר משתנה לפי צריכה, לא הכנסה קבועה מובטחת.'
  from (select id from buildings order by created_at limit 1) b
on conflict (building_id) do nothing;
