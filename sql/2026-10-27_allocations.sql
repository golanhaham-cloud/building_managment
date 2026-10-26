-- שיוך הכנסה קיימת לדירה ולחודשים (בלי לספור את הכסף פעמיים).
-- עיקרון: ההכנסה נשארת שורה אחת ב-transactions (סכום, תאריך ותיאור לא משתנים). השיוך הוא רשומה נפרדת
-- שמצביעה עליה. יתרת הקופה מחושבת מ-transactions בלבד, ולכן שיוך אינו משנה אותה.
-- אין כאן העברת נתונים ואין שיוך אוטומטי: הטבלה נוצרת ריקה.

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  transaction_id uuid not null references public.transactions(id),
  kind text not null check (kind in ('fee','special')),
  apartment_id uuid references public.apartments(id),
  fee_year int check (fee_year is null or fee_year between 2020 and 2100),
  fee_month int check (fee_month is null or fee_month between 1 and 12),
  purpose text check (purpose is null or length(trim(purpose)) between 2 and 120),
  amount numeric(12,2) not null check (amount > 0 and amount < 10000000),
  apartment_basis text check (apartment_basis is null or apartment_basis in ('payer_note','explicit','estimated','unclarified')),
  months_basis text check (months_basis is null or months_basis in ('payer_note','explicit','estimated','unclarified')),
  basis_note text check (basis_note is null or length(basis_note) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references public.app_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references public.app_users(id) on delete set null,
  void_reason text,
  row_version bigint not null default 1,
  -- דמי ועד: דירה + חודש + שנה + בסיסים. מטרה מיוחדת: בלי חודש, עם תיאור מטרה.
  check (
    (kind = 'fee' and apartment_id is not null and fee_year is not null and fee_month is not null and months_basis is not null and purpose is null)
    or (kind = 'special' and fee_year is null and fee_month is null and months_basis is null and purpose is not null)
  ),
  check ((apartment_id is null) = (apartment_basis is null)),
  check (voided_at is null or length(trim(coalesce(void_reason,''))) >= 3)
);
create index if not exists payment_allocations_tx_idx on public.payment_allocations (transaction_id);
create index if not exists payment_allocations_month_idx on public.payment_allocations (apartment_id, fee_year, fee_month) where voided_at is null;
-- מניעת שיוך כפול בטעות: אותו מקור, אותה דירה ואותו חודש פעם אחת בלבד (לשינוי: מבטלים ומשייכים מחדש).
create unique index if not exists payment_allocations_one_per_month on public.payment_allocations (transaction_id, apartment_id, fee_year, fee_month)
  where kind = 'fee' and voided_at is null;

alter table public.payment_allocations enable row level security;
alter table public.payment_allocations force row level security;
-- שיוכי תשלומים (מי שילם עבור איזו דירה) גלויים לוועד בלבד. הדיירים ממשיכים לראות את "נרשם מתוך" כמו היום.
create policy "payment_allocations read admin" on public.payment_allocations for select to authenticated
  using (building_id = auth_building_id() and auth_is_admin());
revoke all on public.payment_allocations from anon, authenticated, public;
grant select on public.payment_allocations to authenticated;
create trigger trg_no_delete before delete on public.payment_allocations for each row execute function trg_no_delete();
create trigger trg_row_version before update on public.payment_allocations for each row execute function trg_row_version();
create trigger trg_audit after insert or update on public.payment_allocations for each row execute function trg_audit();

-- ---------------------------------------------------------------- אכיפה בשרת (גם בשמירות מקבילות)
-- כל הוספת שיוך נועלת את שורת ההכנסה (FOR UPDATE), ולכן שתי שמירות מקבילות על אותו מקור מסתדרות בתור
-- והשנייה רואה את הסכום שכבר הוקצה.
create or replace function public.trg_alloc_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare t transactions; v_sum numeric;
begin
  if TG_OP = 'INSERT' then
    select * into t from transactions where id = NEW.transaction_id for update;
    if t.id is null or t.building_id <> NEW.building_id then raise exception 'INVALID: ההכנסה לא נמצאה'; end if;
    if t.type <> 'income' then raise exception 'INVALID: אפשר לשייך רק תנועת הכנסה'; end if;
    if t.voided_at is not null then raise exception 'INVALID: ההכנסה בוטלה ואי אפשר לשייך אותה'; end if;
    if t.fee_year is not null then raise exception 'INVALID: ההכנסה כבר רשומה ישירות כתשלום ועד לחודש מסוים, ושיוך נוסף היה סופר אותה פעמיים'; end if;
    if NEW.apartment_id is not null and not exists (select 1 from apartments where id = NEW.apartment_id and building_id = NEW.building_id) then
      raise exception 'INVALID: הדירה אינה שייכת לבניין';
    end if;
    if NEW.kind = 'fee' and not exists (select 1 from monthly_payments where apartment_id = NEW.apartment_id and year = NEW.fee_year and month = NEW.fee_month) then
      raise exception 'NO_CHARGE: אין חיוב ועד לחודש %/% לדירה זו. צור חיובים לחודש לפני השיוך', NEW.fee_month, NEW.fee_year;
    end if;
    select coalesce(sum(amount), 0) into v_sum from payment_allocations where transaction_id = NEW.transaction_id and voided_at is null;
    if v_sum + NEW.amount > t.amount then
      raise exception 'OVER_ALLOCATED: אי אפשר לשייך % ₪. ההכנסה היא % ₪, כבר שויכו % ₪ והיתרה הזמינה % ₪', NEW.amount, t.amount, v_sum, t.amount - v_sum;
    end if;
    return NEW;
  end if;
  -- UPDATE: רק בסיסי השיוך וההערה ניתנים לשינוי, וביטול. הסכום, המקור, הדירה והחודש קבועים (לשינוי: ביטול ושיוך מחדש).
  if OLD.voided_at is not null then raise exception 'VOIDED: ההקצאה בוטלה ואינה ניתנת לשינוי'; end if;
  if (NEW.transaction_id, NEW.kind, NEW.apartment_id, NEW.fee_year, NEW.fee_month, NEW.purpose, NEW.amount, NEW.building_id)
     is distinct from (OLD.transaction_id, OLD.kind, OLD.apartment_id, OLD.fee_year, OLD.fee_month, OLD.purpose, OLD.amount, OLD.building_id) then
    raise exception 'IMMUTABLE: סכום, מקור, דירה וחודש של הקצאה אינם ניתנים לשינוי. יש לבטל ולשייך מחדש';
  end if;
  return NEW;
end $$;
create trigger trg_guard before insert or update on public.payment_allocations for each row execute function trg_alloc_guard();

-- שיוך שנוצר/בוטל/שונה מעדכן את "נרשם" של חודש החיוב (דרך אותה פונקציית חישוב קיימת).
create or replace function public.trg_alloc_recompute() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.kind = 'fee' then perform recompute_fee_payment(NEW.apartment_id, NEW.fee_year, NEW.fee_month); end if;
  return null;
end $$;
create trigger trg_recompute after insert or update on public.payment_allocations for each row execute function trg_alloc_recompute();

-- מקור שיש עליו הקצאות פעילות: אי אפשר לבטל אותו, להקטין אותו מתחת למה ששויך, לשנות את סוגו או לרשום אותו ישירות לחודש.
create or replace function public.trg_tx_alloc_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  select coalesce(sum(amount), 0) into v from payment_allocations where transaction_id = OLD.id and voided_at is null;
  if v > 0 then
    if NEW.voided_at is not null and OLD.voided_at is null then
      raise exception 'ALLOCATED: על ההכנסה יש שיוכים פעילים (% ₪). יש לבטל קודם את ההקצאות שלה', v;
    end if;
    if NEW.amount < v then raise exception 'ALLOCATED: אי אפשר להקטין את ההכנסה מתחת ל-% ₪ ששויכו ממנה', v; end if;
    if NEW.type <> OLD.type or (NEW.fee_year is not null and OLD.fee_year is null) then
      raise exception 'ALLOCATED: על ההכנסה יש שיוכים פעילים, ולכן אי אפשר לשנות את סוגה או לרשום אותה ישירות לחודש';
    end if;
  end if;
  return NEW;
end $$;
create trigger trg_alloc_guard before update on public.transactions for each row execute function trg_tx_alloc_guard();

-- ---------------------------------------------------------------- "נרשם" בחודש כולל גם הקצאות
-- ההבדל היחיד מהגרסה הקודמת: נוספו לסכום ששולם הקצאות פעילות מסוג דמי ועד. תאריך התשלום שמוצג הוא תאריך הקבלה המקורי.
create or replace function public.recompute_fee_payment(p_apt uuid, p_year integer, p_month integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_row monthly_payments; v_paid numeric; v_date date; v_apaid numeric; v_adate date; v_adj numeric; v_net numeric; v_status payment_status;
begin
  select * into v_row from monthly_payments where apartment_id = p_apt and year = p_year and month = p_month;
  if v_row.id is null then return; end if;
  select coalesce(sum(amount),0), max(date) into v_paid, v_date from transactions
   where source_apartment_id = p_apt and fee_year = p_year and fee_month = p_month and voided_at is null and type = 'income';
  select coalesce(sum(a.amount),0), max(t.date) into v_apaid, v_adate from payment_allocations a join transactions t on t.id = a.transaction_id
   where a.kind = 'fee' and a.apartment_id = p_apt and a.fee_year = p_year and a.fee_month = p_month and a.voided_at is null;
  v_paid := v_paid + v_apaid;
  v_date := greatest(v_date, v_adate);
  select coalesce(sum(amount),0) into v_adj from fee_adjustments
   where apartment_id = p_apt and year = p_year and month = p_month and voided_at is null;
  v_net := v_row.amount_due + v_adj;
  v_status := case when v_net <= 0 or v_paid >= v_net then 'paid'::payment_status
                   when v_paid > 0 then 'partial'::payment_status else 'unpaid'::payment_status end;
  update monthly_payments set amount_paid = v_paid, status = v_status,
     paid_date = case when v_paid > 0 then v_date else null end,
     updated_at = now(), updated_by = auth_app_user_id()
   where id = v_row.id and (amount_paid is distinct from v_paid or status is distinct from v_status);
end $$;

-- ---------------------------------------------------------------- כתיבה (ועד בלבד)
create or replace function public._insert_allocations(p_tx uuid, p_items jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); it jsonb; n int := 0; v_kind text; v_apt uuid; v_year int; v_month int; v_amt numeric;
        v_ab text; v_mb text; v_note text; v_purpose text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'INVALID: לא נבחר שיוך'; end if;
  if jsonb_array_length(p_items) > 36 then raise exception 'INVALID: יותר מדי שיוכים בפעולה אחת'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_kind := it->>'kind';
    if coalesce(v_kind,'') not in ('fee','special') then raise exception 'INVALID: סוג שיוך לא תקין'; end if;
    if coalesce(it->>'amount','') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$' then raise exception 'INVALID: סכום לא תקין'; end if;
    v_amt := (it->>'amount')::numeric;
    if v_amt <= 0 then raise exception 'INVALID: הסכום חייב להיות חיובי'; end if;
    v_note := nullif(trim(coalesce(it->>'basis_note','')), '');
    v_apt := nullif(it->>'apartment_id','')::uuid;
    v_ab := nullif(it->>'apartment_basis','');
    v_mb := nullif(it->>'months_basis','');
    if v_apt is not null and coalesce(v_ab,'') not in ('payer_note','explicit','estimated','unclarified') then raise exception 'INVALID: יש לבחור בסיס לזהות הדירה'; end if;
    if v_apt is null then v_ab := null; end if;
    if v_kind = 'fee' then
      if v_apt is null then raise exception 'INVALID: יש לבחור דירה'; end if;
      v_year := (it->>'year')::int; v_month := (it->>'month')::int;
      if v_year is null or v_month is null or v_month not between 1 and 12 then raise exception 'INVALID: חודש לא תקין'; end if;
      if coalesce(v_mb,'') not in ('payer_note','explicit','estimated','unclarified') then raise exception 'INVALID: יש לבחור בסיס לחודשי הכיסוי'; end if;
      v_purpose := null;
    else
      v_year := null; v_month := null; v_mb := null;
      v_purpose := nullif(trim(coalesce(it->>'purpose','')), '');
      if v_purpose is null then raise exception 'INVALID: יש להזין את המטרה המיוחדת'; end if;
    end if;
    if (v_ab in ('estimated','unclarified') or v_mb in ('estimated','unclarified')) and length(coalesce(v_note,'')) < 3 then
      raise exception 'INVALID: בשיוך משוער או שטרם הובהר יש להזין הערה';
    end if;
    insert into payment_allocations(building_id, transaction_id, kind, apartment_id, fee_year, fee_month, purpose, amount, apartment_basis, months_basis, basis_note, created_by, updated_by)
    values (u.building_id, p_tx, v_kind, v_apt, v_year, v_month, v_purpose, v_amt, v_ab, v_mb, v_note, u.id, u.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- שיוך הכנסה קיימת. אין יצירת הכנסה חדשה.
create or replace function public.allocate_income(p_tx uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); n int;
begin
  if not exists (select 1 from transactions where id = p_tx and building_id = u.building_id) then raise exception 'NOT_FOUND: ההכנסה לא נמצאה'; end if;
  perform set_config('app.change_reason', 'שיוך הכנסה קיימת', true);
  n := _insert_allocations(p_tx, p_items);
  return jsonb_build_object('status','allocated','count',n);
end $$;

-- תשלום חדש שבאמת אינו קיים בכספים (למשל מזומן): הכנסה אחת בלבד, ושיוכים אליה, הכול בפעולה אחת (או הכול או כלום).
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
  insert into transactions(building_id, type, date, amount, description, payment_method, notes, entered_by, idempotency_key)
  values (u.building_id, 'income', p_date, p_amount, nullif(trim(p_description),''), p_method, nullif(trim(p_notes),''), u.id, p_key)
  returning id into v_id;
  perform set_config('app.change_reason', 'שיוך תשלום חדש', true);
  n := _insert_allocations(v_id, p_items);
  return jsonb_build_object('status','created','id',v_id,'count',n);
end $$;

-- ביטול הקצאה: משחרר רק את הסכום שהוקצה. ההכנסה המקורית אינה משתנה.
create or replace function public.void_allocation(p_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); n int;
begin
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'REASON_REQUIRED: יש להזין סיבה לביטול (לפחות 3 תווים)'; end if;
  perform set_config('app.change_reason', trim(p_reason), true);
  update payment_allocations set voided_at = now(), voided_by = u.id, void_reason = trim(p_reason), updated_at = now(), updated_by = u.id
   where id = p_id and building_id = u.building_id and voided_at is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOT_FOUND: ההקצאה לא נמצאה או שכבר בוטלה'; end if;
  return jsonb_build_object('status','voided');
end $$;

-- עדכון בסיס השיוך וההערה בלבד (הסכום, הדירה והחודש לא משתנים). שינוי בבסיס אחד אינו מאשר את האחר.
create or replace function public.update_allocation_basis(p_id uuid, p_apartment_basis text, p_months_basis text, p_note text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); a payment_allocations; v_note text := nullif(trim(coalesce(p_note,'')), '');
begin
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'REASON_REQUIRED: יש להזין סיבה לשינוי (לפחות 3 תווים)'; end if;
  select * into a from payment_allocations where id = p_id and building_id = u.building_id;
  if a.id is null then raise exception 'NOT_FOUND: ההקצאה לא נמצאה'; end if;
  if a.voided_at is not null then raise exception 'VOIDED: ההקצאה בוטלה ואינה ניתנת לשינוי'; end if;
  if a.apartment_id is not null and coalesce(p_apartment_basis,'') not in ('payer_note','explicit','estimated','unclarified') then raise exception 'INVALID: בסיס זהות הדירה לא תקין'; end if;
  if a.kind = 'fee' and coalesce(p_months_basis,'') not in ('payer_note','explicit','estimated','unclarified') then raise exception 'INVALID: בסיס חודשי הכיסוי לא תקין'; end if;
  if (p_apartment_basis in ('estimated','unclarified') or p_months_basis in ('estimated','unclarified')) and length(coalesce(v_note,'')) < 3 then
    raise exception 'INVALID: בשיוך משוער או שטרם הובהר יש להזין הערה';
  end if;
  perform set_config('app.change_reason', trim(p_reason), true);
  update payment_allocations set apartment_basis = case when a.apartment_id is null then null else p_apartment_basis end,
         months_basis = case when a.kind = 'fee' then p_months_basis else null end,
         basis_note = v_note, updated_at = now(), updated_by = u.id
   where id = p_id;
  return jsonb_build_object('status','updated');
end $$;

-- רשימת הכנסות לבחירה כמקור: תאריך, סכום, תיאור, כמה שויך וכמה זמין. ועד בלבד.
create or replace function public.income_sources()
returns table(id uuid, date date, amount numeric, description text, payment_method text, allocated numeric, available numeric)
language plpgsql stable security definer set search_path = public as $$
declare u app_users := _require_admin();
begin
  return query
  select t.id, t.date, t.amount, t.description, t.payment_method,
         coalesce(sum(a.amount) filter (where a.voided_at is null), 0)::numeric,
         (t.amount - coalesce(sum(a.amount) filter (where a.voided_at is null), 0))::numeric
    from transactions t left join payment_allocations a on a.transaction_id = t.id
   where t.building_id = u.building_id and t.type = 'income' and t.voided_at is null and t.fee_year is null
   group by t.id
   order by t.date desc, t.created_at desc;
end $$;

revoke execute on function public._insert_allocations(uuid, jsonb) from public, anon;
revoke execute on function public.allocate_income(uuid, jsonb) from public, anon;
revoke execute on function public.record_income_with_allocations(date, numeric, text, text, text, uuid, jsonb) from public, anon;
revoke execute on function public.void_allocation(uuid, text) from public, anon;
revoke execute on function public.update_allocation_basis(uuid, text, text, text, text) from public, anon;
revoke execute on function public.income_sources() from public, anon;
