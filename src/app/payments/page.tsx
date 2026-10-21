import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { recordFeePayment } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inp, lbl, ils, monthName } from "@/components/ui";
import Link from "next/link";
import { STATUS_LABELS, STATUS_COLORS, type PaymentStatus } from "@/lib/types";

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

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">תשלומי ועד הבית</h1>
        {isAdmin && (
          <Link href={`/manage/fees?year=${year}&month=${month}`} className="text-sm text-brand-600 font-semibold">
            תעריפים וחיובים ←
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between card py-3">
        <Link href={`/payments?year=${prev.year}&month=${prev.month}`} className="text-brand-600">→ חודש קודם</Link>
        <span className="font-semibold">{monthName(month)} {year}</span>
        <Link href={`/payments?year=${next.year}&month=${next.month}`} className="text-brand-600">חודש הבא ←</Link>
      </div>

      <div className="card">
        <div>סה״כ חיובים: <b>{ils(totalDue)}</b></div>
        <div>התקבל: <b>{ils(totalPaid)}</b></div>
        <div>נותר לגבייה: <b>{ils(Math.max(totalDue - totalPaid, 0))}</b></div>
        <div className="text-sm text-gray-500 mt-1">
          {paidCount} דירות שילמו במלואן
          {undefinedCount > 0 && ` · ל-${undefinedCount} דירות התעריף לחודש זה לא הוגדר`}
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        {sorted.map((apt) => {
          const o: any = byApt.get(apt.id);
          const status = (o?.status ?? "unpaid") as PaymentStatus;
          const adj = Number(o?.adjustments_total ?? 0);
          return (
            <div key={apt.id} className="py-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  דירה {apt.apartment_number} <span className="text-gray-400 text-xs">(קומה {apt.floor})</span>
                </span>
                {o?.has_charge ? (
                  <span className="flex items-center gap-2 text-sm">
                    {ils(o.paid_amount)} / {ils(Number(o.charge_amount) + adj)}
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status]}`} title={STATUS_LABELS[status]} />
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">
                    {o?.tariff_amount == null ? "לא הוגדר" : `תעריף ${ils(o.tariff_amount)} · טרם נוצר חיוב`}
                  </span>
                )}
              </div>
              {o?.has_charge && (
                <div className="text-xs text-gray-400">
                  חיוב {ils(o.charge_amount)}
                  {adj !== 0 && ` · ${adj < 0 ? "זיכוי" : "חיוב נוסף"} ${ils(Math.abs(adj))}`}
                  {` · התקבל ${ils(o.paid_amount)}`}
                </div>
              )}

              {isAdmin && o?.has_charge && (
                <details className="mt-2">
                  <summary className="text-xs text-brand-600 cursor-pointer">רישום תשלום שהתקבל</summary>
                  <ActionForm action={recordFeePayment} className="space-y-2 mt-2">
                    <input type="hidden" name="apartment_id" value={apt.id} />
                    <input type="hidden" name="year" value={year} />
                    <input type="hidden" name="month" value={month} />
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={lbl}>סכום שהתקבל</label><input type="number" name="amount" step="0.01" min="0.01" className={inp} required /></div>
                      <div><label className={lbl}>תאריך</label><input type="date" name="date" defaultValue={now.toISOString().slice(0, 10)} className={inp} required /></div>
                    </div>
                    <select name="method" className={inp} defaultValue="">
                      <option value="">אמצעי תשלום</option>
                      <option value="bank">העברה בנקאית</option>
                      <option value="cash">מזומן</option>
                      <option value="check">שיק</option>
                      <option value="app">ביט / פייבוקס</option>
                    </select>
                    <input type="text" name="notes" placeholder="הערה (אופציונלי)" className={inp} />
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
