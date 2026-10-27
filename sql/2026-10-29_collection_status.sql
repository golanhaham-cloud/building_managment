-- "מצב גבייה וחובות": החלטות ועד על פערים (הפחתה מאושרת / חוב מאומת), כיסוי תנועות הבנק, ופונקציית קריאה לוועד בלבד.
-- החלטה אינה תשלום ואינה הכנסה: לא נוגעים ב-transactions, monthly_payments, fee_adjustments או payment_allocations.

-- ---------------------------------------------------------------- החלטות ועד
create table if not exists public.fee_gap_decisions (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  apartment_id uuid not null references public.apartments(id),
  year int not null check (year between 2020 and 2100),
  month int not null check (month between 1 and 12),
  kind text not null check (kind in ('reduction','verified_debt')),
  amount numeric(12,2) not null check (amount > 0 and amount < 10000000),
  reason text not null check (length(trim(reason)) >= 3 and length(reason) <= 500),
  reported_on date,
  created_at timestamptz not null default now(),
  created_by uuid references public.app_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references public.app_users(id) on delete set null,
  void_reason text,
  row_version bigint not null default 1,
  check (voided_at is null or length(trim(coalesce(void_reason,''))) >= 3)
);
-- החלטה פעילה אחת מכל סוג לדירה ולחודש: מונע החלטות כפולות וקיזוז כפול.
create unique index if not exists fee_gap_decisions_one_active on public.fee_gap_decisions (apartment_id, year, month, kind) where voided_at is null;
create index if not exists fee_gap_decisions_month_idx on public.fee_gap_decisions (building_id, year, month);

alter table public.fee_gap_decisions enable row level security;
alter table public.fee_gap_decisions force row level security;
create policy "fee_gap_decisions read admin" on public.fee_gap_decisions for select to authenticated using (building_id = auth_building_id() and auth_is_admin());
revoke all on public.fee_gap_decisions from anon, authenticated, public;
grant select on public.fee_gap_decisions to authenticated;
create trigger trg_no_delete before delete on public.fee_gap_decisions for each row execute function trg_no_delete();
create trigger trg_row_version before update on public.fee_gap_decisions for each row execute function trg_row_version();
create trigger trg_audit after insert or update on public.fee_gap_decisions for each row execute function trg_audit();

create or replace function public.trg_gap_decision_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if OLD.voided_at is not null then raise exception 'VOIDED: ההחלטה בוטלה ואינה ניתנת לשינוי'; end if;
  if (NEW.apartment_id, NEW.year, NEW.month, NEW.kind, NEW.building_id) is distinct from (OLD.apartment_id, OLD.year, OLD.month, OLD.kind, OLD.building_id) then
    raise exception 'IMMUTABLE: דירה, חודש וסוג החלטה אינם ניתנים לשינוי. יש לבטל ולתעד מחדש';
  end if;
  return NEW;
end $$;
create trigger trg_guard before update on public.fee_gap_decisions for each row execute function trg_gap_decision_guard();

-- תיעוד/עדכון החלטה. הסכום לא יעלה על הפער הפתוח (חיוב כולל התאמות פחות מה ששולם פחות החלטות אחרות באותו חודש).
create or replace function public.set_gap_decision(p_apt uuid, p_year int, p_month int, p_kind text, p_amount numeric, p_reason text, p_reported_on date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); mp monthly_payments; v_net numeric; v_credits numeric; v_other numeric; v_short numeric; v_existing uuid;
begin
  if p_kind not in ('reduction','verified_debt') then raise exception 'INVALID: סוג החלטה לא תקין'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID: הסכום חייב להיות חיובי'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'REASON_REQUIRED: יש להזין סיבה (לפחות 3 תווים)'; end if;
  if not exists (select 1 from apartments where id = p_apt and building_id = u.building_id) then raise exception 'NOT_FOUND: הדירה לא נמצאה'; end if;
  -- נעילת חודש החיוב: שתי החלטות מקבילות על אותו חודש מסתדרות בתור
  select * into mp from monthly_payments where apartment_id = p_apt and year = p_year and month = p_month for update;
  if mp.id is null then raise exception 'NO_CHARGE: אין חיוב לחודש %/% לדירה זו', p_month, p_year; end if;
  select coalesce(sum(amount),0), coalesce(sum(amount) filter (where amount < 0),0) into v_net, v_credits from fee_adjustments
   where apartment_id = p_apt and year = p_year and month = p_month and voided_at is null;
  v_net := mp.amount_due + v_net;
  v_short := v_net - mp.amount_paid;
  if p_kind = 'reduction' and -v_credits >= p_amount then
    raise exception 'CREDIT_EXISTS: בחודש זה כבר קיים זיכוי של % ₪, וההפחתה כבר מיוצגת בחיוב. אין לתעד אותה פעמיים', -v_credits;
  end if;
  select coalesce(sum(amount),0) into v_other from fee_gap_decisions
   where apartment_id = p_apt and year = p_year and month = p_month and voided_at is null and kind <> p_kind;
  if p_amount + v_other > v_short then
    raise exception 'OVER_DECIDED: הפער הפתוח בחודש זה הוא % ₪ (חיוב % ₪, שולם % ₪), ואחרי החלטות אחרות נשארו % ₪', greatest(v_short,0), v_net, mp.amount_paid, greatest(v_short - v_other, 0);
  end if;
  perform set_config('app.change_reason', trim(p_reason), true);
  select id into v_existing from fee_gap_decisions where apartment_id = p_apt and year = p_year and month = p_month and kind = p_kind and voided_at is null;
  if v_existing is not null then
    update fee_gap_decisions set amount = round(p_amount,2), reason = trim(p_reason), reported_on = p_reported_on, updated_at = now(), updated_by = u.id where id = v_existing;
    return jsonb_build_object('status','updated','id',v_existing);
  end if;
  insert into fee_gap_decisions(building_id, apartment_id, year, month, kind, amount, reason, reported_on, created_by, updated_by)
  values (u.building_id, p_apt, p_year, p_month, p_kind, round(p_amount,2), trim(p_reason), p_reported_on, u.id, u.id) returning id into v_existing;
  return jsonb_build_object('status','created','id',v_existing);
end $$;

create or replace function public.void_gap_decision(p_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin(); n int;
begin
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'REASON_REQUIRED: יש להזין סיבה לביטול (לפחות 3 תווים)'; end if;
  perform set_config('app.change_reason', trim(p_reason), true);
  update fee_gap_decisions set voided_at = now(), voided_by = u.id, void_reason = trim(p_reason), updated_at = now(), updated_by = u.id
   where id = p_id and building_id = u.building_id and voided_at is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOT_FOUND: ההחלטה לא נמצאה או שכבר בוטלה'; end if;
  return jsonb_build_object('status','voided');
end $$;

-- ---------------------------------------------------------------- כיסוי תנועות הבנק
-- נפרד ממועד ביצוע הייבוא וממועד רשומות ידניות: covered_until = סוף התקופה שמכוסה בדפי הבנק שיובאו.
create table if not exists public.bank_import_batches (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  covered_from date,
  covered_until date not null,
  imported_at timestamptz not null default now(),
  imported_by uuid references public.app_users(id) on delete set null,
  row_count int,
  source text not null default 'import' check (source in ('import','seed')),
  note text check (note is null or length(note) <= 500)
);
alter table public.bank_import_batches enable row level security;
alter table public.bank_import_batches force row level security;
create policy "bank_import_batches read admin" on public.bank_import_batches for select to authenticated using (building_id = auth_building_id() and auth_is_admin());
revoke all on public.bank_import_batches from anon, authenticated, public;
grant select on public.bank_import_batches to authenticated;
create trigger trg_no_delete before delete on public.bank_import_batches for each row execute function trg_no_delete();
create trigger trg_audit after insert on public.bank_import_batches for each row execute function trg_audit();

create or replace function public.record_bank_import(p_from date, p_until date, p_rows int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin();
begin
  if p_until is null or p_until < date '2000-01-01' or p_until > current_date + 1 then raise exception 'INVALID: תאריך כיסוי לא תקין'; end if;
  insert into bank_import_batches(building_id, covered_from, covered_until, imported_by, row_count, source, note)
  values (u.building_id, p_from, p_until, u.id, p_rows, 'import', 'לפי תאריך התנועה האחרונה בקובץ שיובא');
  return jsonb_build_object('status','recorded');
end $$;

-- כיסוי נוכחי: הקצה המאוחר ביותר של ייבוא בנק, מועד הייבוא האחרון, ורשומות שאחרי הכיסוי (ידניות).
create or replace function public.bank_coverage()
returns table(covered_from date, covered_until date, last_import_at timestamptz, batch_source text, batch_note text, after_count int, after_last_date date)
language plpgsql stable security definer set search_path = public as $$
declare u app_users := _require_admin(); b bank_import_batches;
begin
  select * into b from bank_import_batches where building_id = u.building_id order by covered_until desc, imported_at desc limit 1;
  return query
  select b.covered_from, b.covered_until, b.imported_at, b.source, b.note,
         (select count(*)::int from transactions t where t.building_id = u.building_id and t.voided_at is null and b.covered_until is not null and t.date > b.covered_until),
         (select max(t.date) from transactions t where t.building_id = u.building_id and t.voided_at is null and b.covered_until is not null and t.date > b.covered_until);
end $$;

-- ---------------------------------------------------------------- נתוני גבייה לפי דירה וחודש (ועד בלבד)
create or replace function public.collection_status(p_from_year int, p_from_month int, p_to_year int, p_to_month int)
returns table(apartment_id uuid, year int, month int, base_due numeric, adjustments_total numeric, credits_total numeric, extras_total numeric,
              paid_total numeric, direct_paid numeric, allocated_paid numeric,
              reduction_amount numeric, reduction_id uuid, verified_amount numeric, verified_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare u app_users := _require_admin();
begin
  return query
  select mp.apartment_id, mp.year, mp.month, mp.amount_due,
         coalesce(adj.total,0), coalesce(adj.credits,0), coalesce(adj.extras,0),
         mp.amount_paid,
         coalesce((select sum(t.amount) from transactions t where t.source_apartment_id = mp.apartment_id and t.fee_year = mp.year and t.fee_month = mp.month and t.voided_at is null and t.type = 'income'),0),
         coalesce((select sum(a.amount) from payment_allocations a where a.kind = 'fee' and a.apartment_id = mp.apartment_id and a.fee_year = mp.year and a.fee_month = mp.month and a.voided_at is null),0),
         coalesce(dr.amount,0), dr.id, coalesce(dv.amount,0), dv.id
    from monthly_payments mp
    join apartments ap on ap.id = mp.apartment_id and ap.building_id = u.building_id
    left join lateral (select sum(f.amount) total, sum(f.amount) filter (where f.amount < 0) credits, sum(f.amount) filter (where f.amount > 0) extras
                         from fee_adjustments f where f.apartment_id = mp.apartment_id and f.year = mp.year and f.month = mp.month and f.voided_at is null) adj on true
    left join fee_gap_decisions dr on dr.apartment_id = mp.apartment_id and dr.year = mp.year and dr.month = mp.month and dr.kind = 'reduction' and dr.voided_at is null
    left join fee_gap_decisions dv on dv.apartment_id = mp.apartment_id and dv.year = mp.year and dv.month = mp.month and dv.kind = 'verified_debt' and dv.voided_at is null
   where (mp.year * 12 + mp.month) between (p_from_year * 12 + p_from_month) and (p_to_year * 12 + p_to_month)
   order by mp.year, mp.month;
end $$;

revoke execute on function public.set_gap_decision(uuid, int, int, text, numeric, text, date) from public, anon;
revoke execute on function public.void_gap_decision(uuid, text) from public, anon;
revoke execute on function public.record_bank_import(date, date, int) from public, anon;
revoke execute on function public.bank_coverage() from public, anon;
revoke execute on function public.collection_status(int, int, int, int) from public, anon;

-- ---------------------------------------------------------------- נתוני פתיחה
-- כיסוי הבנק: דפי בנק 1.12.2024–16.10.2026. מועד הייבוא נגזר מרישום התנועות (לא ממועד התנועה הידנית מ-26.10.2026).
insert into public.bank_import_batches(building_id, covered_from, covered_until, imported_at, row_count, source, note)
select b.id, date '2024-12-01', date '2026-10-16',
       coalesce((select max(t.created_at) from public.transactions t where t.building_id = b.id and t.date <= date '2026-10-16' and t.notes is null), now()),
       (select count(*) from public.transactions t where t.building_id = b.id and t.date <= date '2026-10-16' and t.voided_at is null),
       'seed', 'לפי דפי הבנק 1.12.2024–16.10.2026 כפי שדווח על ידי הוועד'
  from (select id from public.buildings order by created_at limit 1) b
 where not exists (select 1 from public.bank_import_batches);

-- הפחתות שאושרו על ידי הוועד: דירה 6, 40 ₪ ביולי 2025 ו-100 ₪ באוגוסט 2026. האישור דווח ב-26.10.2026 (לא בהכרח התקבל באותו יום).
-- הבדיקה: קיים פער פתוח בגובה ההפחתה ואין זיכוי קיים באותו חודש; אחרת ההרצה נעצרת ולא נרשם דבר.
do $$
declare v_apt uuid; v_b uuid; r record; v_net numeric; v_credits numeric; v_paid numeric;
begin
  select a.id, a.building_id into v_apt, v_b from apartments a where a.apartment_number = '6' order by a.created_at limit 1;
  if v_apt is null then raise exception 'דירה 6 לא נמצאה'; end if;
  for r in select * from (values (2025, 7, 40.00), (2026, 8, 100.00)) as t(y, m, amt) loop
    if exists (select 1 from fee_gap_decisions where apartment_id = v_apt and year = r.y and month = r.m and kind = 'reduction' and voided_at is null) then continue; end if;
    select mp.amount_due + coalesce((select sum(amount) from fee_adjustments f where f.apartment_id = v_apt and f.year = r.y and f.month = r.m and f.voided_at is null),0),
           coalesce((select sum(amount) from fee_adjustments f where f.apartment_id = v_apt and f.year = r.y and f.month = r.m and f.voided_at is null and amount < 0),0), mp.amount_paid
      into v_net, v_credits, v_paid from monthly_payments mp where mp.apartment_id = v_apt and mp.year = r.y and mp.month = r.m;
    if v_net is null then raise exception 'אין חיוב לדירה 6 ב-%/%', r.m, r.y; end if;
    if v_credits <> 0 then raise exception 'כבר קיים זיכוי בדירה 6 ב-%/%: ההפחתה כבר מיוצגת', r.m, r.y; end if;
    if v_net - v_paid < r.amt then raise exception 'הפער בדירה 6 ב-%/% (%) קטן מההפחתה %', r.m, r.y, v_net - v_paid, r.amt; end if;
    perform set_config('app.change_reason', 'תיעוד הפחתה שאושרה על ידי הוועד', true);
    insert into fee_gap_decisions(building_id, apartment_id, year, month, kind, amount, reason, reported_on)
    values (v_b, v_apt, r.y, r.m, 'reduction', r.amt, 'הפחתה שאושרה על ידי הוועד. האישור דווח ב-26.10.2026; מועד האישור בפועל לא נקבע. תועד על ידי המערכת לפי דיווח הוועד.', date '2026-10-26');
  end loop;
end $$;
