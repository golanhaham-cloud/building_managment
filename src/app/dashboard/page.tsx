import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { balanceDisplay, latestReview, rowState, sortByFloorThenNumber, NEUTRAL_NOTE } from "@/lib/completeness";
import Link from "next/link";
import NewsTicker from "@/components/NewsTicker";
import { monthName } from "@/components/ui";
import { STATUS_COLORS } from "@/lib/types";

const DOT = { paid: STATUS_COLORS.paid, partial: STATUS_COLORS.partial, unpaid: STATUS_COLORS.unpaid, neutral: "bg-gray-300" };

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

  const { count: txCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("building_id", buildingId)
    .is("voided_at", null);
  const bal = balanceDisplay(txCount ?? 0, balance?.current_balance);
  const { data: reviewRows } = await supabase
    .from("fee_month_reviews")
    .select("year, month, is_complete, created_at")
    .eq("year", year)
    .eq("month", month);
  const reviewed = latestReview(reviewRows as any, year, month)?.is_complete === true;

  const { data: latestAnnouncements } = await supabase
    .from("announcements")
    .select("id, title, body, is_important, created_at, building_id")
    .eq("building_id", buildingId)
    .order("created_at", { ascending: false })
    .limit(5);
  const isAdmin = appUser?.role === "admin";
  const today = now.toISOString().slice(0, 10);
  const { data: openReqs } = await supabase
    .from("requests")
    .select("id, urgency, status")
    .eq("building_id", buildingId)
    .not("status", "in", "(resolved,closed)");
  const openReqCount = openReqs?.length ?? 0;
  const urgentReqCount = (openReqs ?? []).filter((r: any) => r.urgency === "urgent" || r.urgency === "high").length;
  // Committee tasks: queried for committee members only (RLS also enforces this).
  const openTasks = isAdmin
    ? (await supabase.from("committee_tasks").select("id, due_date, status").eq("building_id", buildingId).in("status", ["open", "in_progress"])).data ?? []
    : null;
  const overdueTaskCount = (openTasks ?? []).filter((t: any) => t.due_date && t.due_date < today).length;

  const { data: payments } = await supabase
    .from("monthly_payments")
    .select("status, amount_due, amount_paid, apartment_id, apartments(apartment_number, floor)")
    .eq("year", year)
    .eq("month", month);

  const { data: thisMonthTx } = await supabase
    .from("transactions")
    .select("type, amount")
    .is("voided_at", null)
    .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
    .lt("date", month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`);

  const monthIncome =
    thisMonthTx?.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const monthExpense =
    thisMonthTx?.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0) ?? 0;

  const paidCount = payments?.filter((p) => p.status === "paid").length ?? 0;
  const totalApts = payments?.length ?? 0;
  const monthLabel = `${monthName(month)} ${year}`;
  const chargesTotal = (payments ?? []).reduce((s, p: any) => s + Number(p.amount_due), 0);
  const recordedTotal = (payments ?? []).reduce((s, p: any) => s + Number(p.amount_paid), 0);
  const pct = totalApts ? Math.round((paidCount / totalApts) * 100) : 0;

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-gray-500 text-sm">שלום {appUser?.role === "admin" ? "ועד הבית" : "דייר/ת"} 👋</p>
        <h1 className="text-xl font-extrabold">{building?.name ?? "הבניין שלנו"}</h1>
      </div>

      <NewsTicker items={(latestAnnouncements ?? []).map((a: any) => ({ id: a.id, title: a.title, is_important: !!a.is_important }))} />

      <div className={`grid gap-3 ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
        <Link href="/requests" className="card block active:bg-gray-50">
          <div className="text-sm text-gray-500">🔧 תקלות פתוחות</div>
          <div className="big-number">{openReqCount}</div>
          {urgentReqCount > 0 && <div className="text-xs text-orange-700">מתוכן {urgentReqCount} בדחיפות גבוהה/דחופה</div>}
          <div className="text-xs text-brand-700 mt-1">לרשימת התקלות ›</div>
        </Link>
        {isAdmin && (
          <Link href="/manage/tasks" className="card block active:bg-gray-50">
            <div className="text-sm text-gray-500">✅ משימות ועד 🔒</div>
            <div className="big-number">{openTasks?.length ?? 0}</div>
            {overdueTaskCount > 0 && <div className="text-xs text-orange-700">{overdueTaskCount} עברו את תאריך היעד</div>}
            <div className="text-xs text-brand-700 mt-1">למשימות הוועד ›</div>
          </Link>
        )}
      </div>

      {bal.verified ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="card col-span-2">
            <div className="text-sm text-gray-500">💰 יתרת קופה כוללת</div>
            <div className="big-number text-brand-700">{ils(bal.balance)}</div>
            <div className="text-xs text-gray-500">יתרה מצטברת, לא נתון של {monthLabel}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500">📥 הכנסות {monthLabel}</div>
            <div className="big-number">{ils(monthIncome)}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500">📤 הוצאות {monthLabel}</div>
            <div className="big-number">{ils(monthExpense)}</div>
          </div>
        </div>
      ) : (
        <div className="card border border-amber-200 bg-amber-50">
          <div className="font-semibold text-amber-800">💰 טרם נרשמו תנועות; יתרת הקופה אינה מאומתת</div>
          <p className="text-xs text-amber-800 mt-1">
            זה לא אומר שאין חיובים או תשלומים: חיובי הוועד והתשלומים שנרשמו מוצגים בנפרד, בכרטיס הגבייה למטה.
          </p>
          {isAdmin && (
            <div className="flex gap-2 mt-3">
              <Link href="/finances" className="flex-1 text-center text-sm font-semibold rounded-xl border border-brand-600 text-brand-700 py-2 bg-white">רישום תנועה</Link>
              <Link href="/finances/import" className="flex-1 text-center text-sm font-semibold rounded-xl border border-brand-600 text-brand-700 py-2 bg-white">ייבוא מהבנק</Link>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="text-sm text-gray-500">🏠 גביית ועד · {monthLabel} {!reviewed && "(רישום חלקי)"}</div>
        <div className="big-number">{paidCount}/{totalApts}</div>
        <div className="text-xs text-gray-500">דירות שנרשם להן תשלום מלא</div>
        <div className="text-sm mt-2">חיובי {monthLabel}: <b>{ils(chargesTotal)}</b> · תשלומים שנרשמו: <b>{ils(recordedTotal)}</b></div>
        {!reviewed && <div className="text-xs text-amber-700 mt-1">הרישום חלקי ואינו בהכרח משקף את החוב בפועל</div>}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold">מצב גביית ועד הבית · {monthLabel}</span>
          {reviewed && <span className="text-sm text-gray-500">{pct}%</span>}
        </div>
        {reviewed ? (
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-sm p-2">⚠️ {NEUTRAL_NOTE}</div>
        )}

        <details className="group mt-3">
          <summary className="list-none cursor-pointer select-none rounded-xl border border-brand-600 text-brand-700 font-semibold text-sm min-h-[44px] flex items-center justify-center [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">הצג פירוט לפי דירה ({totalApts}) ▾</span>
            <span className="hidden group-open:inline">הסתר פירוט לפי דירה ▴</span>
          </summary>
        <div className="mt-3 divide-y divide-gray-100">
          {sortByFloorThenNumber(payments ?? [], (p: any) => Number(p.apartments.floor), (p: any) => p.apartments.apartment_number).map((p: any) => {
            const st = rowState({ reviewed, paid: Number(p.amount_paid), due: Number(p.amount_due) });
            return (
              <div key={p.apartment_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  דירה {p.apartments.apartment_number}{" "}
                  <span className="text-gray-500">(קומה {p.apartments.floor})</span>
                </span>
                <span className="flex items-center gap-2 text-end">
                  <span>
                    {st.label}
                    <span className="block text-xs text-gray-500">{ils(p.amount_paid)} / {ils(p.amount_due)}</span>
                  </span>
                  <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${DOT[st.dot]}`} title={st.label} />
                </span>
              </div>
            );
          })}
        </div>
        </details>
      </div>
    </div>
  );
}
