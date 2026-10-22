import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { recordFeePayment, setMonthReview } from "@/lib/manage-actions";
import { latestReview, paymentsSummary, rowState } from "@/lib/completeness";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inp, lbl, ils, monthName } from "@/components/ui";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/types";

const DOT = { paid: STATUS_COLORS.paid, partial: STATUS_COLORS.partial, unpaid: STATUS_COLORS.unpaid, neutral: "bg-gray-300" };

export default async function PaymentsPage({ searchParams }: { searchParams: { year?: string; month?: string } }) {
  const now = new Date();
  const year = Number(searchParams.year) || now.getFullYear();
  const month = Number(searchParams.month) || now.getMonth() + 1;

  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";

  const { data: apartments } = await supabase
    .from("apartments")
    .select("id, floor, apartment_number")
    .eq("building_id", appUser?.building_id);
  const sorted = [...(apartments ?? [])].sort((a, b) => Number(a.apartment_number) - Number(b.apartment_number));

  const { data: overview } = await supabase.rpc("month_fee_overview", { p_year: year, p_month: month });
  const { data: reviewRows } = await supabase
    .from("fee_month_reviews")
    .select("year, month, is_complete, created_at, created_by")
    .eq("year", year)
    .eq("month", month);
  const review = latestReview(reviewRows as any, year, month);
  const reviewed = review?.is_complete === true;
  const byApt = new Map((overview ?? []).map((o: any) => [o.apartment_id, o]));

  let totalDue = 0;
  let totalPaid = 0;
  let paidCount = 0;
  let undefinedCount = 0;
  for (const a of sorted) {
    const o: any = byApt.get(a.id);
    if (!o?.has_charge) {
      if (o?.tariff_amount == null) undefinedCount++;
      continue;
    }
    totalDue += Number(o.charge_amount) + Number(o.adjustments_total ?? 0);
    totalPaid += Number(o.paid_amount);
    if (o.status === "paid") paidCount++;
  }

  const sum = paymentsSummary({ charges: totalDue, recorded: totalPaid, reviewed });
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">תשלומי ועד הבית</h1>
        {isAdmin && (
          <Link href={`/manage/fees?year=${year}&month=${month}`} className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">
            תעריפים וחיובים ←
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between card py-3">
        <Link href={`/payments?year=${prev.year}&month=${prev.month}`} className="text-brand-700 inline-flex items-center min-h-[44px]">→ חודש קודם</Link>
        <span className="font-semibold">{monthName(month)} {year}</span>
        <Link href={`/payments?year=${next.year}&month=${next.month}`} className="text-brand-700 inline-flex items-center min-h-[44px]">חודש הבא ←</Link>
      </div>

      <div className="card space-y-1">
        <div>חיובים: <b>{ils(sum.charges)}</b></div>
        <div>תשלומים שנרשמו: <b>{ils(sum.recorded)}</b></div>
        <div>
          יתרה לפי הרישום באתר:{" "}
          {sum.balance === null ? <span className="text-gray-500">לא מוצגת עד אישור השלמת הרישום</span> : <b>{ils(sum.balance)}</b>}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          {paidCount} דירות נרשם להן תשלום מלא
          {undefinedCount > 0 && ` · ל-${undefinedCount} דירות התעריף לחודש זה לא הוגדר`}
        </div>
        {sum.partial ? (
          <div className="mt-2 rounded-lg bg-amber-50 text-amber-800 text-sm p-2">⚠️ {sum.warning}<br />{sum.note}</div>
        ) : (
          <div className="mt-2 rounded-lg bg-green-50 text-green-800 text-sm p-2">
            ✔ רישום החודש נבדק והושלם על ידי הוועד ({new Date(review!.created_at).toLocaleDateString("he-IL")})
          </div>
        )}
        {isAdmin && (
          <ActionForm action={setMonthReview} className="mt-2 space-y-2">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="complete" value={reviewed ? "false" : "true"} />
            <SubmitButton
              className="w-full text-sm py-1.5 rounded-xl border border-brand-600 text-brand-700 font-semibold disabled:opacity-60"
              confirmText={reviewed ? "לבטל את סימון השלמות של החודש?" : `לאשר שהרישום של ${monthName(month)} ${year} נבדק והושלם? גם אם לא התקבלו תשלומים כלל, החודש יוצג כמלא.`}
            >
              {reviewed ? "בטל סימון \"נבדק והושלם\"" : "סמן שרישום החודש נבדק והושלם"}
            </SubmitButton>
          </ActionForm>
        )}
      </div>

      <div className="card divide-y divide-gray-100">
        {sorted.map((apt) => {
          const o: any = byApt.get(apt.id);
          const adj = Number(o?.adjustments_total ?? 0);
          const st = o?.has_charge ? rowState({ reviewed, paid: Number(o.paid_amount), due: Number(o.charge_amount) + adj }) : null;
          return (
            <div key={apt.id} className="py-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  דירה {apt.apartment_number} <span className="text-gray-500 text-xs">(קומה {apt.floor})</span>
                </span>
                {o?.has_charge ? (
                  <span className="flex items-center gap-2 text-sm">
                    {st!.label}
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${DOT[st!.dot]}`} title={st!.label} />
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">
                    {o?.tariff_amount == null ? "לא הוגדר" : `תעריף ${ils(o.tariff_amount)} · טרם נוצר חיוב`}
                  </span>
                )}
              </div>
              {o?.has_charge && (
                <div className="text-xs text-gray-500">
                  חיוב {ils(o.charge_amount)}
                  {adj !== 0 && ` · ${adj < 0 ? "זיכוי" : "חיוב נוסף"} ${ils(Math.abs(adj))}`}
                  {` · נרשם ${ils(o.paid_amount)} מתוך ${ils(Number(o.charge_amount) + adj)}`}
                </div>
              )}

              {isAdmin && o?.has_charge && (
                <details className="mt-2">
                  <summary className="text-sm text-brand-700 cursor-pointer">רישום תשלום שהתקבל</summary>
                  <ActionForm action={recordFeePayment} className="space-y-2 mt-2">
                    <input type="hidden" name="apartment_id" value={apt.id} />
                    <input type="hidden" name="year" value={year} />
                    <input type="hidden" name="month" value={month} />
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={lbl}>סכום שהתקבל</label><input type="number" aria-label="סכום שהתקבל" name="amount" step="0.01" min="0.01" className={inp} required /></div>
                      <div><label className={lbl}>תאריך</label><input type="date" aria-label="תאריך" name="date" defaultValue={now.toISOString().slice(0, 10)} className={inp} required /></div>
                    </div>
                    <select name="method" aria-label="אמצעי תשלום" className={inp} defaultValue="">
                      <option value="">אמצעי תשלום</option>
                      <option value="bank">העברה בנקאית</option>
                      <option value="cash">מזומן</option>
                      <option value="check">שיק</option>
                      <option value="app">ביט / פייבוקס</option>
                    </select>
                    <input type="text" aria-label="הערה" name="notes" placeholder="הערה (אופציונלי)" className={inp} />
                    <p className="text-xs text-gray-500">התשלום נרשם פעם אחת כהכנסה בקופה ומעדכן את חיוב הדירה. אין צורך להוסיף אותו שוב ידנית.</p>
                    <SubmitButton>רשום תשלום</SubmitButton>
                  </ActionForm>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
