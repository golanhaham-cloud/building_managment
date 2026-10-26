import { balanceBreakdown, type BalanceRow } from "@/lib/opening-balance";
import { ils } from "@/components/ui";

const d = (s: string) => new Date(s).toLocaleDateString("he-IL");

// פירוט היתרה המחושבת: יתרת פתיחה + נטו תנועות, ועד איזה תאריך קיימות תנועות.
export default function BalanceBreakdown({ row }: { row: BalanceRow | null | undefined }) {
  const b = balanceBreakdown(row);
  return (
    <div className="text-xs text-gray-600 space-y-0.5 mt-1" data-balance-breakdown="">
      {b.opening !== null ? (
        <div>
          יתרת פתיחה <b>{ils(b.opening)}</b>{b.startDate ? ` (תחילת רישום ${d(b.startDate)})` : ""} + נטו תנועות <b>{ils(b.net)}</b> = <b>{ils(b.balance)}</b>
        </div>
      ) : (
        <div>לא הוגדרה יתרת פתיחה: היתרה היא נטו התנועות שנרשמו.</div>
      )}
      <div>
        {b.lastTransactionDate ? `לפי תנועות שנרשמו באתר עד ${d(b.lastTransactionDate)}. ` : "טרם נרשמו תנועות. "}
        יתרה מחושבת מהרישום, לא יתרת הבנק העדכנית.
      </div>
      {b.excluded > 0 && (
        <div className="text-amber-700">{b.excluded} תנועות לפני תאריך תחילת הרישום אינן נכללות ביתרה (הן מגולמות ביתרת הפתיחה).</div>
      )}
    </div>
  );
}
