import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { markPayment } from "@/lib/actions";
import Link from "next/link";
import { STATUS_LABELS, STATUS_COLORS, type PaymentStatus } from "@/lib/types";

function ils(n: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const now = new Date();
  const year = Number(searchParams.year) || now.getFullYear();
  const month = Number(searchParams.month) || now.getMonth() + 1;

  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";

  const { data: apartments } = await supabase
    .from("apartments")
    .select("id, floor, apartment_number, monthly_fee")
    .eq("building_id", appUser?.building_id)
    .order("floor")
    .order("apartment_number");

  const { data: payments } = await supabase
    .from("monthly_payments")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .in("apartment_id", (apartments ?? []).map((a) => a.id));

  const byApt = new Map((payments ?? []).map((p) => [p.apartment_id, p]));

  const totalDue = (apartments ?? []).reduce((s, a) => s + Number(a.monthly_fee), 0);
  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount_paid), 0);
  const paidCount = (payments ?? []).filter((p) => p.status === "paid").length;

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">תשלומי ועד הבית</h1>

      <div className="flex items-center justify-between card py-3">
        <Link href={`/payments?year=${prevMonth.year}&month=${prevMonth.month}`} className="text-brand-600">
          → חודש קודם
        </Link>
        <span className="font-semibold">{month}/{year}</span>
        <Link href={`/payments?year=${nextMonth.year}&month=${nextMonth.month}`} className="text-brand-600">
          חודש הבא ←
        </Link>
      </div>

      <div className="card">
        <div>סה״כ נדרש: <b>{ils(totalDue)}</b></div>
        <div>שולם: <b>{ils(totalPaid)}</b></div>
        <div>נותר לגבייה: <b>{ils(Math.max(totalDue - totalPaid, 0))}</b></div>
        <div className="text-sm text-gray-500 mt-1">
          {apartments?.length ?? 0} דירות · {paidCount} שילמו
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        {apartments?.map((apt) => {
          const p = byApt.get(apt.id);
          const status = (p?.status ?? "unpaid") as PaymentStatus;
          return (
            <div key={apt.id} className="py-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  דירה {apt.apartment_number} <span className="text-gray-400 text-xs">(קומה {apt.floor})</span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                  {ils(p?.amount_paid ?? 0)} / {ils(apt.monthly_fee)}
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status]}`}
                    title={STATUS_LABELS[status]}
                  />
                </span>
              </div>

              {isAdmin && (
                <form action={markPayment} className="flex items-center gap-2 mt-2">
                  <input type="hidden" name="apartment_id" value={apt.id} />
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="month" value={month} />
                  <input type="hidden" name="amount_due" value={apt.monthly_fee} />
                  <input
                    type="number"
                    name="amount_paid"
                    step="0.01"
                    defaultValue={p?.amount_paid ?? 0}
                    className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                  />
                  <button type="submit" className="text-xs bg-brand-600 text-white rounded-lg px-3 py-1.5">
                    עדכן/י
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
