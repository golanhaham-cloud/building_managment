-- דיירים רואים את החיוב הסופי לחודש (בסיס + התאמות). adjustments_total נשאר חשוף לוועד בלבד.
create or replace function public.month_fee_overview(p_year integer, p_month integer)
returns table(apartment_id uuid, tariff_amount numeric, charge_amount numeric, adjustments_total numeric, paid_amount numeric, status payment_status, has_charge boolean)
language plpgsql stable security definer set search_path to 'public' as $function$
declare v_b uuid := auth_building_id(); v_admin boolean := auth_is_admin();
begin
  if v_b is null then return; end if;
  return query
  select a.id, effective_fee(a.id, p_year, p_month),
         case when v_admin or mp.amount_due is null then mp.amount_due
              else mp.amount_due + coalesce((select sum(f.amount) from fee_adjustments f where f.apartment_id = a.id and f.year = p_year and f.month = p_month and f.voided_at is null), 0) end,
         case when v_admin then coalesce((select sum(f.amount) from fee_adjustments f where f.apartment_id = a.id and f.year = p_year and f.month = p_month and f.voided_at is null), 0) else null end,
         mp.amount_paid, mp.status, (mp.id is not null)
  from apartments a
  left join monthly_payments mp on mp.apartment_id = a.id and mp.year = p_year and mp.month = p_month
  where a.building_id = v_b;
end $function$;
