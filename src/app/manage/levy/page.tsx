import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { peopleByApartment, type DirectoryPerson } from "@/lib/apartment-people";
import { fromAg } from "@/lib/allocations";
import { ils } from "@/components/ui";
import { LEVY_PURPOSE, LEVY_TARGET_AG, LEVY_STATE_LABELS, levyState, summarizeLevy, type LevyAlloc } from "@/lib/levy";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "שיפור הבניין - מצב גבייה" };

const money = (ag: number) => ils(fromAg(ag));
const dateHe = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("he-IL") : "—");

const STATE_STYLE: Record<string, string> = {
  full: "bg-green-50 text-green-800",
  partial: "bg-amber-50 text-amber-800",
  none: "bg-gray-100 text-gray-600",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-extrabold">{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
    </div>
  );
}

// מצב גביית התשלום החד-פעמי לשיפור הבניין. תצוגה בלבד, ועד בלבד (כמו שאר עמודי /manage).
// מקור: שיוכי "מטרה מיוחדת" עם המטרה LEVY_PURPOSE. שיוך מובנה לדירה גובר; שיוכים ישנים
// מזוהים לפי "דירה N" בהערה ומסומנים ככאלה. "אין רישום" אינו חוב.
export default async function LevyPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-xl font-extrabold">שיפור הבניין - מצב גבייה</h1>
        <div className="card text-sm">המסך זמין לוועד בלבד.</div>
        <Link href="/payments" className="text-brand-700 inline-flex items-center min-h-[44px]">→ חזרה לתשלומי ועד</Link>
      </div>
    );
  }
  const supabase = createClient();
  const [{ data: aptRows }, { data: allocRows }, { data: dirRows }] = await Promise.all([
    supabase.from("apartments").select("id, floor, apartment_number").eq("building_id", appUser.building_id),
    supabase
      .from("payment_allocations")
      .select("id, amount, apartment_id, purpose, basis_note, created_at, transactions:transaction_id(date), apartments:apartment_id(apartment_number)")
      .eq("building_id", appUser.building_id)
      .eq("kind", "special")
      .is("voided_at", null)
      .order("created_at", { ascending: true }),
    supabase.rpc("get_resident_directory"),
  ]);
  const apartments = [...(aptRows ?? [])]
    .sort((a: any, b: any) => Number(a.apartment_number) - Number(b.apartment_number))
    .map((a: any) => ({ id: a.id, number: String(a.apartment_number), floor: a.floor }));
  const allocs: LevyAlloc[] = (allocRows ?? []).map((a: any) => ({
    id: a.id,
    amount: Number(a.amount),
    apartment_id: a.apartment_id ?? null,
    purpose: a.purpose ?? null,
    basis_note: a.basis_note ?? null,
    date: a.transactions?.date ?? null,
    created_at: a.created_at ?? null,
  }));
  const summary = summarizeLevy(apartments, allocs);
  const who = peopleByApartment((dirRows ?? []) as DirectoryPerson[]);
  const fullCount = summary.rows.filter((r) => levyState(r.paidAg) === "full").length;
  const targetAg = LEVY_TARGET_AG * apartments.length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">שיפור הבניין - מצב גבייה</h1>
        <Link href="/payments" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">תשלומי ועד ←</Link>
      </div>

      <div className="card text-sm space-y-1">
        <p>מעקב אחר התשלום החד־פעמי לשיפור הבניין: יעד התייחסות של {ils(fromAg(LEVY_TARGET_AG))} לדירה ({apartments.length} דירות, {money(targetAg)} בסך הכול). התשלום אינו דמי ועד חודשיים ואינו משנה חיוב או סטטוס של חודש.</p>
        <p className="text-gray-600">״אין רישום״ אינו חוב: ייתכן שהתשלום שולם וטרם שויך לדירה, או שקיים הסדר אחר.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="נגבה עד כה" value={money(summary.totalAg)} />
        <Stat label="יעד התייחסות" value={money(targetAg)} hint={`${ils(fromAg(LEVY_TARGET_AG))} לדירה`} />
        <Stat label="שילמו במלואו" value={`${fullCount} מתוך ${apartments.length}`} />
      </div>

      <section className="card space-y-2">
        <h2 className="font-bold">לפי דירה</h2>
        <ul className="divide-y divide-gray-100">
          {summary.rows.map((r) => {
            const st = levyState(r.paidAg);
            const names = who.get(r.apartment_id) ?? [];
            return (
              <li key={r.apartment_id} className="py-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <span className="font-semibold">דירה {r.number}</span>
                    {names.length > 0 && <span className="text-xs text-gray-500"> · {names.join(", ")}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-sm">{money(r.paidAg)} מתוך {ils(fromAg(LEVY_TARGET_AG))}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATE_STYLE[st]}`}>{LEVY_STATE_LABELS[st]}</span>
                  </div>
                </div>
                {r.items.length > 0 && (
                  <ul className="mt-1 text-xs text-gray-600 space-y-0.5">
                    {r.items.map((it) => (
                      <li key={it.id} className="tabular-nums">
                        {ils(it.amount)} · התקבל {dateHe(it.date)}{it.via === "note" ? " · שויך לדירה לפי ההערה" : ""}{it.note ? ` · ${it.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {summary.unassigned.length > 0 && (
        <section className="card space-y-2 border-amber-300 bg-amber-50">
          <h2 className="font-bold">שיוכים ללא דירה מזוהה</h2>
          <p className="text-xs text-amber-900">שיוכים אלה נספרים בסך ״נגבה עד כה״ אך לא שויכו לדירה. אפשר לעדכן את הערת השיוך במסך השיוך (עדכון בסיס) כך שתכלול ״דירה N״.</p>
          <ul className="text-sm divide-y divide-amber-100">
            {summary.unassigned.map((it) => (
              <li key={it.id} className="py-1.5 tabular-nums">{ils(it.amount)} · התקבל {dateHe(it.date)}{it.note ? ` · ${it.note}` : ""}</li>
            ))}
          </ul>
        </section>
      )}

      {summary.otherPurposes.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-bold">שיוכי מטרה מיוחדת עם מטרה אחרת</h2>
          <p className="text-xs text-gray-600">אינם נספרים בסיכום לעיל, שמבוסס על המטרה ״{LEVY_PURPOSE}״ בדיוק. אם אחד מהם נועד בפועל לשיפור הבניין, אפשר לבטל ולשייך מחדש עם המטרה המדויקת.</p>
          <ul className="text-sm divide-y divide-gray-100">
            {summary.otherPurposes.map((g) => (
              <li key={g.purpose} className="py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{g.purpose}</span>
                  <span className="tabular-nums">{money(g.totalAg)} · {g.count === 1 ? "שיוך אחד" : `${g.count} שיוכים`}</span>
                </div>
                <ul className="text-xs text-gray-600 mt-0.5 space-y-0.5">
                  {g.items.map((it) => (
                    <li key={it.id} className="tabular-nums">{ils(it.amount)} · התקבל {dateHe(it.date)}{it.note ? ` · ${it.note}` : ""}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-gray-500">מקור הנתונים: שיוכי ״מטרה מיוחדת״ עם המטרה ״{LEVY_PURPOSE}״ בלבד. שיוכים שנשמרו בלי דירה מזוהים לפי ״דירה N״ בהערת השיוך. דמי ועד חודשיים מוצגים ב<Link href="/manage/collection" className="text-brand-700">מצב גבייה וחובות</Link>.</p>
    </div>
  );
}
