-- שיוך ידני של תנועות הוצאה להוצאה קבועה בתחזית. תצוגה/היסטוריה בלבד: לא משנה סכומים, תאריכים, יתרות או תחזית.
-- אין שיוך אוטומטי: העמודה ריקה עד שהוועד משייך במפורש. השינוי נרשם ביומן הביקורת (trg_audit) עם סיבה.
alter table public.transactions
  add column if not exists forecast_item_id uuid references public.forecast_items(id) on delete restrict;
create index if not exists transactions_forecast_item_idx on public.transactions(forecast_item_id) where forecast_item_id is not null;

create or replace function public.link_transactions_to_forecast_item(p_ids uuid[], p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  u app_users := _require_admin();
  v_name text;
  v_bad int;
  v_changed int;
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then
    raise exception 'EMPTY: לא נבחרו תנועות';
  end if;
  if array_length(p_ids, 1) > 200 then
    raise exception 'TOO_MANY: אפשר לשייך עד 200 תנועות בבת אחת';
  end if;
  if p_item_id is not null then
    select name into v_name from forecast_items where id = p_item_id and building_id = u.building_id;
    if v_name is null then raise exception 'NOT_FOUND: ההוצאה הקבועה לא נמצאה'; end if;
  end if;
  -- הכול או כלום: כל התנועות חייבות להיות הוצאות פעילות (לא מבוטלות) של הבניין.
  select count(*) into v_bad from unnest(p_ids) i
   where not exists (select 1 from transactions t where t.id = i and t.building_id = u.building_id and t.type = 'expense' and t.voided_at is null);
  if v_bad > 0 then
    raise exception 'INVALID: % מהתנועות שנבחרו אינן הוצאה פעילה בבניין (ייתכן שבוטלו). לא בוצע שינוי', v_bad;
  end if;
  perform set_config('app.change_reason', case when p_item_id is null then 'ביטול שיוך להוצאה קבועה' else 'שיוך להוצאה קבועה: ' || v_name end, true);
  update transactions set forecast_item_id = p_item_id
   where id = any(p_ids) and building_id = u.building_id and forecast_item_id is distinct from p_item_id;
  get diagnostics v_changed = row_count;
  return jsonb_build_object('status', 'ok', 'changed', v_changed, 'requested', array_length(p_ids, 1));
end $$;

revoke all on function public.link_transactions_to_forecast_item(uuid[], uuid) from public, anon;
grant execute on function public.link_transactions_to_forecast_item(uuid[], uuid) to authenticated;
