import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { addAdjustment, voidAdjustment, generateCharges } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inp, lbl, ils, monthName } from "@/components/ui";
import TariffForm from "./TariffForm";

export default async function FeesPage({ searchParams }: { searchParams: { year?: string; month?: string } }) {
  const now = new Date();
  const year = Number(searchParams.year) || now.getFullYear();
  const month = Number(searchParams.month) || now.getMonth() + 1;
  const supabase = createClient();
  const u = await getCurrentAppUser();

  const { data: apts } = await supabase.from("apartments").select("id, apartment_number, monthly_fee").eq("building_id", u?.building_id);
  const sorted = [...(apts ?? [])].sort((a, b) => Number(a.apartment_number) - Number(b.apartment_number));
  const { data: overview } = await supabase.rpc("month_fee_overview", { p_year: year, p_month: month });
  const ov = new Map((overview ?? []).map((o: any) => [o.apartment_id, o]));

  const { data: tariffs } = await supabase.from("fee_tariffs").select("*").eq("building_id", u?.building_id).order("effective_from", { ascending: false }).order("created_at", { ascending: false });
  const { data: tApts } = await supabase.from("fee_tariff_apartments").select("tariff_id, apartment_id").in("tariff_id", (tariffs ?? []).map((t: any) => t.id));
  const numById = new Map(sorted.map((a) => [a.id, a.apartment_number]));

  const { data: adjustments } = await supabase
    .from("fee_adjustments")
    .select("id, apartment_id, amount, reason, created_at, voided_at, void_reason")
    .eq("building_id", u?.building_id)
    .eq("year", year)
    .eq("month", month)
    .order("created_at", { ascending: false });

  const needCharges = sorted.filter((a) => !(ov.get(a.id) as any)?.has_charge && (ov.get(a.id) as any)?.tariff_amount != null).length;
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const defaultMonth = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">תעריפים, חיובים וזיכויים</h1>
        <Link href="/manage" className="text-sm text-brand-600 font-semibold">ניהול ←</Link>
      </div>

      <div className="flex items-center justify-between card py-3">
        <Link href={`/manage/fees?year=${prev.year}&month=${prev.month}`} className="text-brand-600">→ קודם</Link>
        <span className="font-semibold">{monthName(month)} {year}</span>
        <Link href={`/manage/fees?year=${next.year}&month=${next.month}`} className="text-brand-600">הבא ←</Link>
      </div>

      <div className="card space-y-2">
        <div className="font-semibold text-sm">מצב החודש לפי דירה</div>
        <div className="text-xs text-gray-500">תעריף = מה שמוגדר לחודש, חיוב = מה שנוצר בפועל, שולם = מה שהתקבל. חודש ללא תעריף מוצג "לא הוגדר" ולא כאפס.</div>
        <div className="divide-y divide-gray-100">
          {sorted.map((a) => {
            const o: any = ov.get(a.id);
            return (
              <div key={a.id} className="py-2 text-sm flex justify-between">
                <span>דירה {a.apartment_number}</span>
                <span className="text-xs text-gray-600 text-left">
                  תעריף: {o?.tariff_amount == null ? <b className="text-status-partial">לא הוגדר</b> : ils(o.tariff_amount)}
                  {" · "}חיוב: {o?.has_charge ? ils(o.charge_amount) : "טרם נוצר"}
                  {Number(o?.adjustments_total ?? 0) !== 0 && ` · התאמות: ${ils(o.adjustments_total)}`}
                  {o?.has_charge && ` · שולם: ${ils(o.paid_amount)}`}
                </span>
              </div>
            );
          })}
        </div>
        {needCharges > 0 && (
          <ActionForm action={generateCharges} className="pt-2">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
            <SubmitButton confirmText={`ליצור חיוב לחודש ${month}/${year} ל-${needCharges} דירות? הסכום נלקח מהתעריף שמוגדר לחודש.`}>
              צור חיובים ל-{needCharges} דירות ללא חיוב
            </SubmitButton>
          </ActionForm>
        )}
      </div>

      <div className="card">
        <div className="font-semibold text-sm mb-2">תעריף חדש</div>
        <TariffForm
          defaultMonth={defaultMonth}
          apartments={sorted.map((a) => ({
            id: a.id,
            number: a.apartment_number,
            legacy: Number(a.monthly_fee),
            current: (ov.get(a.id) as any)?.tariff_amount ?? null,
          }))}
        />
      </div>

      <div className="card space-y-2">
        <div className="font-semibold text-sm">היסטוריית תעריפים (לא נמחקת ולא נערכת)</div>
        {(tariffs ?? []).length === 0 && <p className="text-sm text-gray-400">עדיין לא הוגדרו תעריפים.</p>}
        {(tariffs ?? []).map((t: any) => {
          const list = (tApts ?? []).filter((x: any) => x.tariff_id === t.id).map((x: any) => numById.get(x.apartment_id)).filter(Boolean);
          return (
            <div key={t.id} className="text-sm border-b border-gray-100 pb-2">
              <b>{ils(t.amount)}</b> · מ-{new Date(t.effective_from).toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
              <div className="text-xs text-gray-500">{t.scope === "all" ? "כל הדירות" : `דירות: ${list.join(", ")}`} · סיבה: {t.reason}</div>
              <div className="text-xs text-gray-400">נוצר {new Date(t.created_at).toLocaleDateString("he-IL")}</div>
            </div>
          );
        })}
      </div>

      <div className="card space-y-3">
        <div className="font-semibold text-sm">זיכוי או חיוב נוסף לדירה - {monthName(month)} {year}</div>
        <p className="text-xs text-gray-500">התאמה נפרדת מהתעריף ומהתשלום. אפשר לבטל, לא למחוק.</p>
        <ActionForm action={addAdjustment} className="space-y-2">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <select name="apartment_id" className={inp} required defaultValue="">
            <option value="" disabled>בחר דירה</option>
            {sorted.map((a) => <option key={a.id} value={a.id}>דירה {a.apartment_number}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select name="kind" className={inp}>
              <option value="credit">זיכוי (מוריד חיוב)</option>
              <option value="charge">חיוב נוסף</option>
            </select>
            <input name="amount" type="number" step="0.01" min="0.01" placeholder="סכום" className={inp} required />
          </div>
          <input name="reason" placeholder="סיבה (חובה)" className={inp} required minLength={2} />
          <SubmitButton confirmText="לשמור את ההתאמה לחיוב של הדירה בחודש זה?">שמור התאמה</SubmitButton>
        </ActionForm>

        <div className="divide-y divide-gray-100">
          {(adjustments ?? []).map((a: any) => (
            <div key={a.id} className="py-2 text-sm">
              <div className={`flex justify-between ${a.voided_at ? "line-through text-gray-400" : ""}`}>
                <span>דירה {numById.get(a.apartment_id)} · {a.reason}</span>
                <b>{a.amount < 0 ? "זיכוי " : "חיוב "}{ils(Math.abs(a.amount))}</b>
              </div>
              {a.voided_at ? (
                <div className="text-xs text-status-unpaid">בוטל: {a.void_reason}</div>
              ) : (
                <ActionForm action={voidAdjustment} className="flex gap-2 mt-1">
                  <input type="hidden" name="id" value={a.id} />
                  <input name="reason" placeholder="סיבת ביטול" className={inp} required minLength={2} />
                  <SubmitButton className="text-xs border border-gray-300 rounded-lg px-3 whitespace-nowrap" confirmText="לבטל את ההתאמה?">בטל</SubmitButton>
                </ActionForm>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
