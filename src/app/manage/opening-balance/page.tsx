import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { saveOpeningBalance } from "@/lib/opening-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import BalanceBreakdown from "@/components/BalanceBreakdown";
import AuditList from "@/components/AuditList";
import { userNameMap, type AuditEntry } from "@/lib/audit";
import { inp, lbl, ils } from "@/components/ui";
import Link from "next/link";
import DoneBanner from "@/components/DoneBanner";

export const dynamic = "force-dynamic";

export default async function OpeningBalancePage({ searchParams }: { searchParams: { saved?: string } }) {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-xl font-extrabold">יתרת פתיחה</h1>
        <div className="card text-sm">המסך זמין לוועד בלבד.</div>
      </div>
    );
  }
  const supabase = createClient();
  const [{ data: ob }, { data: bal }, { data: log }] = await Promise.all([
    supabase.from("opening_balance").select("amount, start_date, note, updated_at").eq("building_id", appUser.building_id).maybeSingle(),
    supabase.from("building_balance").select("*").eq("building_id", appUser.building_id).maybeSingle(),
    supabase.from("audit_log").select("*").eq("entity_type", "opening_balance").order("created_at", { ascending: false }).limit(20),
  ]);
  const names = await userNameMap(supabase, (log ?? []).map((l: any) => l.user_id));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">יתרת פתיחה</h1>
        <Link href="/manage" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">ניהול ←</Link>
      </div>

      {searchParams.saved === "1" && <DoneBanner path="/manage/opening-balance" keep="" text="יתרת הפתיחה ותאריך תחילת הרישום נשמרו (נשמר ביומן). לא נוצרה תנועת הכנסה." />}

      <div className="card text-sm space-y-1">
        <p>יתרת הפתיחה היא הסכום שהיה בחשבון הוועד <b>לפני</b> תחילת הרישום באתר. היא נשמרת בנפרד מההכנסות וההוצאות, <b>אינה תנועת הכנסה</b> ואינה נכללת בדוחות ההכנסות וההוצאות או בתחזית.</p>
        <p className="text-gray-600">יתרת הקופה = יתרת פתיחה + הכנסות פעילות − הוצאות פעילות, מתאריך תחילת הרישום ואילך (כולל אותו יום). תנועות מבוטלות אינן נספרות, ותנועות קודמות לתאריך זה אינן נכללות (הן מגולמות ביתרת הפתיחה).</p>
      </div>

      <div className="card">
        <div className="text-sm text-gray-500">יתרה מחושבת כעת</div>
        <div className="big-number text-brand-700">{ils(Number((bal as any)?.current_balance ?? 0))}</div>
        <BalanceBreakdown row={bal as any} />
      </div>

      <ActionForm action={saveOpeningBalance} keepOnSuccess className="card space-y-2">
        <h2 className="font-bold">עדכון יתרת פתיחה</h2>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lbl}>סכום יתרת הפתיחה (₪)</label><input name="amount" aria-label="סכום יתרת הפתיחה" type="number" step="0.01" inputMode="decimal" defaultValue={ob?.amount ?? ""} className={inp} required /></div>
          <div><label className={lbl}>תאריך תחילת הרישום</label><input name="start_date" aria-label="תאריך תחילת הרישום" type="date" defaultValue={ob?.start_date ?? ""} className={inp} required /></div>
        </div>
        <input name="reason" aria-label="סיבת השינוי" className={inp} placeholder="סיבת השינוי (חובה, נשמרת ביומן)" required minLength={3} />
        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">שינוי התאריך משנה אילו תנועות נכללות ביתרה. לא נוצרות או משתנות תנועות, תעריפים, חיובים או שיוכים.</p>
        <SubmitButton confirmText="לשמור את יתרת הפתיחה ותאריך תחילת הרישום? היתרה בקופה תחושב מחדש.">שמור</SubmitButton>
      </ActionForm>

      <section className="card">
        <h2 className="font-bold mb-2">יומן שינויים</h2>
        <AuditList entries={(log ?? []) as AuditEntry[]} names={names} showEntity={false} />
      </section>
    </div>
  );
}
