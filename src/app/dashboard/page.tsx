import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { balanceDisplay, latestReview, sortByFloorThenNumber, NEUTRAL_NOTE } from "@/lib/completeness";
import { collectionSummary } from "@/lib/collection";
import Link from "next/link";
import NewsTicker from "@/components/NewsTicker";
import BalanceBreakdown from "@/components/BalanceBreakdown";
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
  // Join requests: committee only (RLS also limits rows to the committee's own building).
  const pendingJoinCount = isAdmin
    ? (await supabase.from("join_requests").select("id", { count: "exact", head: true }).eq("building_id", buildingId).eq("status", "pending")).count ?? 0
    : 0;
  const overdueTaskCount = (openTasks ?? []).filter((t: any) => t.due_date && t.due_date < today).length;

  // אותו מקור חישוב של מסך התשלומים: month_fee_overview (חיוב בסיס + חיובים נוספים − זיכויים).
  const [{ data: overview }, { data: aptRows }] = await Promise.all([
    supabase.rpc("month_fee_overview", { p_year: year, p_month: month }),
    supabase.from("apartments").select("id, apartment_number, floor").eq("building_id", buildingId),
  ]);
  const aptById = new Map((aptRows ?? []).map((a: any) => [a.id, a]));

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

  const monthLabel = `${monthName(month)} ${year}`;
  const coll = collectionSummary((overview ?? []) as any, reviewed);
  const paidCount = coll.fullCount;
  const totalApts = coll.count;
  const chargesTotal = coll.due;
  const recordedTotal = coll.paid;
  const pct = coll.pct;

  const calcBalance = bal.verified
    ? new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(bal.balance)
    : null;

  // סיכום כספי קצר: זהה לשני התפקידים. אזהרות (יתרה מחושבת, רישום חלקי, נתונים לא מאומתים) גלויות תמיד;
  // נוסחת היתרה, הכנסות/הוצאות, גבייה מלאה ופירוט לפי דירה נפתחים ב"פירוט". אותם חישובים והרשאות כמו קודם.
  const financeSummary = (
    <section className="card space-y-2" aria-label="תמונת מצב כספית" data-section="finance-summary">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">תמונת מצב כספית</h2>
        <Link href="/finances" className="text-sm text-brand-700 font-semibold inline-flex items-center min-h-[44px]">לכספים ›</Link>
      </div>
      {bal.verified ? (
        <div>
          <div className="text-sm text-gray-500">💰 יתרת קופה מחושבת</div>
          <div className="big-number text-brand-700">{calcBalance}</div>
          <div className="text-xs text-amber-800" data-warning="calculated-balance">יתרה מחושבת מהרישום באתר, לא יתרת הבנק העדכנית.</div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" data-warning="unverified-balance">
          <div className="font-semibold text-amber-800">💰 טרם נרשמו תנועות; יתרת הקופה אינה מאומתת</div>
          <p className="text-xs text-amber-800 mt-1">זה לא אומר שאין חיובים או תשלומים: חיובי הוועד והתשלומים שנרשמו מוצגים בנפרד, בפירוט הגבייה.</p>
          {isAdmin && (
            <div className="flex gap-2 mt-3">
              <Link href="/finances" className="flex-1 text-center text-sm font-semibold rounded-xl border border-brand-600 text-brand-700 py-2 min-h-[44px] bg-white flex items-center justify-center">רישום תנועה</Link>
              <Link href="/finances/import" className="flex-1 text-center text-sm font-semibold rounded-xl border border-brand-600 text-brand-700 py-2 min-h-[44px] bg-white flex items-center justify-center">ייבוא מהבנק</Link>
            </div>
          )}
        </div>
      )}
      <div className="border-t border-gray-100 pt-2">
        <div className="text-sm text-gray-500">🏠 גביית ועד · {monthLabel}</div>
        <div className="text-lg font-extrabold">{paidCount}/{totalApts} <span className="text-sm font-normal text-gray-600">דירות שנרשם להן תשלום מלא</span></div>
        {!reviewed && (
          <div className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2 mt-1" data-warning="partial-recording">⚠️ {NEUTRAL_NOTE}</div>
        )}
      </div>

      <details className="group" data-details="finance">
        <summary className="list-none cursor-pointer select-none rounded-xl border border-brand-600 text-brand-700 font-semibold text-sm min-h-[44px] flex items-center justify-center [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">פירוט ▾</span>
          <span className="hidden group-open:inline">הסתר פירוט ▴</span>
        </summary>
        <div className="mt-3 space-y-4">
          {bal.verified && (
            <div>
              <div className="text-xs text-gray-500">יתרה מצטברת, לא נתון של {monthLabel}</div>
              <BalanceBreakdown row={balance as any} />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="rounded-lg bg-gray-50 p-2">
                  <div className="text-xs text-gray-500">📥 הכנסות {monthLabel}</div>
                  <div className="font-extrabold">{ils(monthIncome)}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <div className="text-xs text-gray-500">📤 הוצאות {monthLabel}</div>
                  <div className="font-extrabold">{ils(monthExpense)}</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">מצב גביית ועד הבית · {monthLabel}</span>
              {reviewed && <span className="text-sm text-gray-500">{pct}%</span>}
            </div>
            <div className="text-sm space-y-0.5 mb-2">
              <div>סך חיובים לחודש: <b>{ils(chargesTotal)}</b></div>
              <div>סך ששולם: <b>{ils(recordedTotal)}</b></div>
            </div>
            {reviewed ? (
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
            ) : (
              <div className="rounded-lg bg-amber-50 text-amber-800 text-sm p-2">⚠️ {NEUTRAL_NOTE}</div>
            )}
            {isAdmin && <Link href="/manage/collection" className="text-sm text-brand-700 font-semibold inline-flex items-center min-h-[44px]">מצב גבייה וחובות ›</Link>}
          </div>

          <details className="group" data-details="by-apartment">
            <summary className="list-none cursor-pointer select-none rounded-xl border border-brand-600 text-brand-700 font-semibold text-sm min-h-[44px] flex items-center justify-center [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">הצג פירוט לפי דירה ({totalApts}) ▾</span>
              <span className="hidden group-open:inline">הסתר פירוט לפי דירה ▴</span>
            </summary>
            <div className="mt-3 divide-y divide-gray-100">
              {sortByFloorThenNumber(coll.list, (p) => Number(aptById.get(p.apartment_id)?.floor ?? 0), (p) => aptById.get(p.apartment_id)?.apartment_number ?? 0).map((p) => {
                const apt: any = aptById.get(p.apartment_id);
                const st = p.state;
                return (
                  <div key={p.apartment_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>דירה {apt?.apartment_number} <span className="text-gray-500">(קומה {apt?.floor})</span></span>
                    <span className="flex items-center gap-2 text-end">
                      <span>
                        {st.label}
                        <span className="block text-xs text-gray-500">שולם: {ils(p.paid)}</span>
                        <span className="block text-xs text-gray-500">חיוב לחודש: {ils(p.due)}</span>
                      </span>
                      <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${DOT[st.dot]}`} title={st.label} />
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        </div>
      </details>
    </section>
  );

  const news = <NewsTicker items={(latestAnnouncements ?? []).map((a: any) => ({ id: a.id, title: a.title, is_important: !!a.is_important }))} />;

  const urgencyNote = urgentReqCount > 0 ? `מתוכן ${urgentReqCount} בדחיפות גבוהה/דחופה` : null;

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-gray-500 text-sm">שלום {isAdmin ? "ועד הבית" : "דייר/ת"} 👋</p>
        <h1 className="text-xl font-extrabold">{building?.name ?? "הבניין שלנו"}</h1>
      </div>

      {isAdmin ? (
        <>
          <section className="card space-y-1" aria-label="דורש טיפול" data-section="attention">
            <h2 className="font-bold">דורש טיפול</h2>
            <Link href="/requests" className="flex items-center justify-between gap-3 min-h-[44px] border-t border-gray-100 first-of-type:border-0">
              <span>🔧 תקלות פתוחות <b>{openReqCount}</b>{urgencyNote && <span className="block text-xs text-orange-700">{urgencyNote}</span>}</span>
              <span className="text-xs text-brand-700">לתקלות ›</span>
            </Link>
            <Link href="/manage/tasks" className="flex items-center justify-between gap-3 min-h-[44px] border-t border-gray-100">
              <span>✅ משימות ועד 🔒 <b>{openTasks?.length ?? 0}</b>{overdueTaskCount > 0 && <span className="block text-xs text-orange-700">{overdueTaskCount} עברו את תאריך היעד</span>}</span>
              <span className="text-xs text-brand-700">למשימות ›</span>
            </Link>
            {pendingJoinCount > 0 && (
              <Link href="/manage/join-requests" className="flex items-center justify-between gap-3 min-h-[44px] border-t border-gray-100" data-item="join-requests">
                <span>🙋 {pendingJoinCount === 1 ? "בקשת הצטרפות אחת ממתינה" : `${pendingJoinCount} בקשות הצטרפות ממתינות`}</span>
                <span className="text-xs text-brand-700">לאישור ›</span>
              </Link>
            )}
          </section>
          {news}
          {financeSummary}
        </>
      ) : (
        <>
          {news}
          <Link href="/requests?new=1" className="btn-primary w-full text-center text-base font-bold min-h-[52px] flex items-center justify-center rounded-xl" data-action="report-issue">
            🔧 דיווח על תקלה
          </Link>
          <Link href="/requests" className="card flex items-center justify-between gap-3 min-h-[44px] active:bg-gray-50" data-section="open-issues">
            <span>
              <span className="text-sm text-gray-500">תקלות פתוחות</span>
              <span className="block text-xl font-extrabold">{openReqCount}</span>
              {urgencyNote && <span className="block text-xs text-orange-700">{urgencyNote}</span>}
            </span>
            <span className="text-xs text-brand-700">לרשימת התקלות ›</span>
          </Link>
          {financeSummary}
        </>
      )}
    </div>
  );
}
