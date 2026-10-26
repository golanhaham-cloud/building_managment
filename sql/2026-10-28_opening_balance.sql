-- יתרת פתיחה לחשבון הוועד, בנפרד מתנועות הכספים (transactions).
-- לא נוצרת תנועת הכנסה. יתרת הקופה = יתרת פתיחה + הכנסות פעילות - הוצאות פעילות מתאריך תחילת הרישום ואילך (כולל אותו יום).
-- דוחות הכנסות/הוצאות (total_income, total_expenses, monthly_balance) והתחזית אינם משתנים.

create table if not exists public.opening_balance (
  building_id uuid primary key references public.buildings(id),
  amount numeric(12,2) not null check (amount > -100000000 and amount < 100000000),
  start_date date not null check (start_date >= date '2000-01-01'),
  note text check (note is null or length(note) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id) on delete set null,
  row_version bigint not null default 1
);
alter table public.opening_balance enable row level security;
alter table public.opening_balance force row level security;
create policy "opening_balance read building" on public.opening_balance for select to authenticated using (building_id = auth_building_id());
revoke all on public.opening_balance from anon, authenticated, public;
grant select on public.opening_balance to authenticated;
create trigger trg_no_delete before delete on public.opening_balance for each row execute function trg_no_delete();
create trigger trg_row_version before update on public.opening_balance for each row execute function trg_row_version();
create trigger trg_audit after insert or update on public.opening_balance for each row execute function trg_audit();

-- כתיבה: ועד בלבד, עם סיבה. כל שינוי נשמר ביומן עם הערך הקודם.
create or replace function public.set_opening_balance(p_amount numeric, p_start_date date, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u app_users := _require_admin();
begin
  if p_amount is null or p_amount <= -100000000 or p_amount >= 100000000 then raise exception 'INVALID: סכום יתרת הפתיחה לא תקין'; end if;
  if p_start_date is null or p_start_date < date '2000-01-01' or p_start_date > current_date + 31 then raise exception 'INVALID: תאריך תחילת הרישום לא תקין'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'REASON_REQUIRED: יש להזין סיבה לשינוי (לפחות 3 תווים)'; end if;
  perform set_config('app.change_reason', trim(p_reason), true);
  insert into opening_balance(building_id, amount, start_date, updated_by) values (u.building_id, round(p_amount, 2), p_start_date, u.id)
  on conflict (building_id) do update set amount = excluded.amount, start_date = excluded.start_date, updated_at = now(), updated_by = u.id,
         row_version = opening_balance.row_version;
  return jsonb_build_object('status','saved');
end $$;
revoke execute on function public.set_opening_balance(numeric, date, text) from public, anon;

-- נתוני הפתיחה לפי דוח הבנק: 3,653.50 ₪ לפני התנועה הראשונה של 1.12.2024. אין תנועת הכנסה.
insert into public.opening_balance(building_id, amount, start_date, note)
select b.id, 3653.50, date '2024-12-01', 'לפי דוח הבנק, לפני התנועה הראשונה של 1.12.2024'
  from (select id from public.buildings order by created_at limit 1) b
on conflict (building_id) do nothing;

-- היתרה המחושבת. העמודות הקיימות נשארות באותו סדר וסוג; נוספו עמודות בסוף. total_income/total_expenses נשארו כמות שהיו (כל התנועות הפעילות).
create or replace view public.building_balance with (security_invoker = true) as
 select b.id as building_id,
        coalesce(ob.amount, 0) + coalesce(sum(case when t.type = 'income' and (ob.start_date is null or t.date >= ob.start_date) then t.amount else 0 end), 0)
                               - coalesce(sum(case when t.type = 'expense' and (ob.start_date is null or t.date >= ob.start_date) then t.amount else 0 end), 0) as current_balance,
        coalesce(sum(case when t.type = 'income' then t.amount else 0 end), 0) as total_income,
        coalesce(sum(case when t.type = 'expense' then t.amount else 0 end), 0) as total_expenses,
        ob.amount as opening_balance,
        ob.start_date as opening_start_date,
        coalesce(sum(case when t.type = 'income' and (ob.start_date is null or t.date >= ob.start_date) then t.amount else 0 end), 0)
          - coalesce(sum(case when t.type = 'expense' and (ob.start_date is null or t.date >= ob.start_date) then t.amount else 0 end), 0) as net_since_start,
        max(t.date) as last_transaction_date,
        count(t.id) filter (where ob.start_date is not null and t.date < ob.start_date) as excluded_before_start
   from buildings b
   left join opening_balance ob on ob.building_id = b.id
   left join transactions t on t.building_id = b.id and t.voided_at is null
  group by b.id, ob.amount, ob.start_date;
