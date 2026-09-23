import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { STATUS_COLORS, STATUS_LABELS, type PaymentStatus } from "@/lib/types";

function ils(n: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function DashboardPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const buildingId = appUser?.building_id;

  const [{ data: balance }, { data: building }] = await Promise.all([
    supabase.from("building_balance").select("*").eq("building_id", buildingId).maybeSingle(),
    supabase.from("buildings").select("name").eq("id", buildingId).single(),
  ]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: payments } = await supabase
    .from("monthly_payments")
    .select("status, amount_due, amount_paid, apartment_id, apartments(apartment_number, floor)")
    .eq("year", year)
    .eq("month", month);

  const { data: thisMonthTx } = await supabase
    .from("transactions")
    .select("type, amount")
    .gte("date", `${year}-${String(month).padStart(2, "0")}-01`);

  const monthIncome =
    thisMonthTx?.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const monthExpense =
    thisMonthTx?.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0) ?? 0;

  const paidCount = payments?.filter((p) => p.status === "paid").length ?? 0;
  const totalApts = payments?.length ?? 0;
  const pct = totalApts ? Math.round((paidCount / totalApts) * 100) : 0;

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-gray-500 text-sm">שלום {appUser?.role === "admin" ? "ועד הבית" : "דייר/ת"} 👋</p>
        <h1 className="text-xl font-extrabold">{building?.name ?? "הבניין שלנו"}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="text-sm text-gray-500">💰 יתרה בקופה</div>
          <div className="big-number text-brand-700">{ils(balance?.current_balance ?? 0)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">📥 הכנסות החודש</div>
          <div className="big-number">{ils(monthIncome)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">📤 הוצאות החודש</div>
          <div className="big-number">{ils(monthExpense)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">🏠 גביית ועד</div>
          <div className="big-number">
            {paidCount}/{totalApts}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold">מצב גביית ועד הבית</span>
          <span className="text-sm text-gray-500">{pct}%</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-4 divide-y divide-gray-100">
          {payments
            ?.sort((a: any, b: any) => a.apartments.floor - b.apartments.floor)
            .map((p: any) => (
              <div key={p.apartment_id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  דירה {p.apartments.apartment_number}{" "}
                  <span className="text-gray-400">(קומה {p.apartments.floor})</span>
                </span>
                <span className="flex items-center gap-2">
                  {ils(p.amount_paid)} / {ils(p.amount_due)}
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      STATUS_COLORS[p.status as PaymentStatus]
                    }`}
                    title={STATUS_LABELS[p.status as PaymentStatus]}
                  />
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
