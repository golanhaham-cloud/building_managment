import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { addTransactionAction, correctTransaction, voidTransaction } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import AuditList from "@/components/AuditList";
import { userNameMap, type AuditEntry } from "@/lib/audit";
import { inp, lbl, btnDanger, ils, monthName } from "@/components/ui";
import Link from "next/link";
import BalanceBreakdown from "@/components/BalanceBreakdown";
import { parseFilters, filterTransactions, summarize, isFiltered, activeCount, NO_CAT, NO_APT, type TxRow } from "@/lib/tx-filter";

export default async function FinancesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";

  const { data: txAll } = await supabase
    .from("transactions")
    .select("id, type, date, amount, description, notes, category_id, supplier_id, row_version, voided_at, void_reason, fee_year, fee_month, categories(name), suppliers(name), apartments:source_apartment_id(apartment_number)")
    .eq("building_id", appUser?.building_id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: balanceRow } = await supabase.from("building_balance").select("*").eq("building_id", appUser?.building_id).maybeSingle();

  const [{ data: categories }, { data: suppliers }] = isAdmin
    ? await Promise.all([
        supabase.from("categories").select("id, name, type").eq("building_id", appUser?.building_id).order("name"),
        supabase.from("suppliers").select("id, name").eq("building_id", appUser?.building_id).order("name"),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

  // כמה מכל הכנסה שויך לדירות/חודשים (ועד בלבד). השיוך אינו משנה את הסכום או את היתרה.
  const allocated = new Map<string, number>();
  const allocApts = new Map<string, Set<string>>(); // דירות לפי שיוכים פעילים (לסינון בלבד)
  if (isAdmin) {
    const { data: al } = await supabase.from("payment_allocations").select("transaction_id, amount, apartments:apartment_id(apartment_number)").eq("building_id", appUser?.building_id).is("voided_at", null);
    for (const a of al ?? []) {
      allocated.set((a as any).transaction_id, (allocated.get((a as any).transaction_id) ?? 0) + Number((a as any).amount));
      const n = (a as any).apartments?.apartment_number;
      if (n != null) { const s = allocApts.get((a as any).transaction_id) ?? new Set<string>(); s.add(String(n)); allocApts.set((a as any).transaction_id, s); }
    }
  }

  // סינון וחיפוש: על כל התנועות שנטענו (ללא עימוד), כך שהסיכומים תמיד על כל התוצאות המסוננות.
  const filters = parseFilters(searchParams ?? {});
  if (!isAdmin) filters.apt = ""; // שיוכים גלויים לוועד בלבד
  const filtered = isFiltered(filters);
  const allRows = (txAll ?? []) as any[];
  const tx = filterTransactions(allRows as TxRow[], filters, allocApts) as any[];
  const sum = summarize(tx);
  const years = Array.from(new Set(allRows.map((r) => String(r.date).slice(0, 4)))).sort().reverse();
  const catList = new Map<string, string>();
  for (const r of allRows) if (r.category_id && r.categories?.name) catList.set(r.category_id, r.categories.name);
  const aptList = new Set<string>(); for (const s of Array.from(allocApts.values())) s.forEach((x) => aptList.add(x));
  for (const r of allRows) if (r.apartments?.apartment_number != null) aptList.add(String(r.apartments.apartment_number));
  const aptSorted = Array.from(aptList).sort((x, y) => Number(x) - Number(y));

  let history = new Map<string, AuditEntry[]>();
  let names = new Map<string, string>();
  if (isAdmin && tx.length) {
    const { data: log } = await supabase
      .from("audit_log")
      .select("*")
      .eq("entity_type", "transactions")
      .in("entity_id", tx.map((t: any) => t.id))
      .order("created_at", { ascending: false });
    for (const e of (log ?? []) as AuditEntry[]) {
      const arr = history.get(e.entity_id!) ?? [];
      arr.push(e);
      history.set(e.entity_id!, arr);
    }
    names = await userNameMap(supabase, (log ?? []).map((l: any) => l.user_id));
  }

  const catOptions = (categories ?? []).map((c: any) => (
    <option key={c.id} value={c.id}>{c.name}</option>
  ));
  const supOptions = (suppliers ?? []).map((c: any) => (
    <option key={c.id} value={c.id}>{c.name}</option>
  ));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">כספי הבניין</h1>
        <div className="flex items-center gap-4">
          <Link href="/forecast" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">תחזית ←</Link>
          <Link href="/payments" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">תשלומי ועד ←</Link>
        </div>
      </div>
      <div className="card">
        <div className="text-sm text-gray-500">💰 יתרת קופה מחושבת</div>
        <div className="big-number text-brand-700">{ils(Number((balanceRow as any)?.current_balance ?? 0))}</div>
        <BalanceBreakdown row={balanceRow as any} />
        {isAdmin && <Link href="/manage/opening-balance" className="text-xs text-brand-700 underline inline-flex items-center min-h-[44px]">יתרת פתיחה ותאריך תחילת רישום</Link>}
      </div>

      {isAdmin && (
        <Link href="/finances/import" className="card block text-center text-sm font-semibold text-brand-600">
          📥 ייבוא תנועות מקובץ הבנק
        </Link>
      )}

      {isAdmin && (
        <details className="card">
          <summary className="font-semibold cursor-pointer text-sm">+ הוספת תנועה</summary>
          <ActionForm action={addTransactionAction} className="space-y-2 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <select name="type" className={inp} required>
                <option value="expense">הוצאה</option>
                <option value="income">הכנסה</option>
              </select>
              <input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inp} required />
            </div>
            <input type="number" name="amount" step="0.01" min="0.01" placeholder="סכום בש״ח" className={inp} required />
            <input type="text" name="description" placeholder="תיאור (למשל: ניקיון חדר מדרגות)" className={inp} required />
            <div className="grid grid-cols-2 gap-2">
              <select name="category_id" className={inp}>
                <option value="">קטגוריה (אופציונלי)</option>
                {catOptions}
              </select>
              <select name="supplier_id" className={inp}>
                <option value="">ספק (אופציונלי)</option>
                {supOptions}
              </select>
            </div>
            <input type="text" name="notes" placeholder="הערה (גלויה לדיירים)" className={inp} />
            <SubmitButton>הוסף תנועה</SubmitButton>
          </ActionForm>
        </details>
      )}

      <div data-section="tx-filter" className="card space-y-3">
        <details open={filtered} className="group">
          <summary className="cursor-pointer inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold text-brand-700" data-action="toggle-filter">
            🔎 סינון וחיפוש{filtered ? ` (${activeCount(filters)} פעילים)` : ""}
          </summary>
          <form method="get" action="/finances" className="space-y-2 mt-2" data-form="tx-filter">
            <div>
              <label className={lbl} htmlFor="f-q">חיפוש בתיאור, בהערה, בקטגוריה או בספק (כולל שמות מעבירים ומקבלי תשלום)</label>
              <input id="f-q" type="search" name="q" defaultValue={filters.q} placeholder="למשל: כהן, ניקיון" className={inp} maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lbl} htmlFor="f-type">סוג תנועה</label>
                <select id="f-type" name="type" defaultValue={filters.type} className={inp}>
                  <option value="all">הכל</option><option value="income">הכנסות</option><option value="expense">הוצאות</option>
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="f-cat">קטגוריה</label>
                <select id="f-cat" name="cat" defaultValue={filters.cat} className={inp}>
                  <option value="">כל הקטגוריות</option>
                  {Array.from(catList.entries()).sort((a, b) => a[1].localeCompare(b[1], "he")).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                  <option value={NO_CAT}>ללא קטגוריה</option>
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="f-year">שנה</label>
                <select id="f-year" name="year" defaultValue={filters.year} className={inp}>
                  <option value="">כל התקופה</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="f-month">חודש</label>
                <select id="f-month" name="month" defaultValue={filters.month} className={inp}>
                  <option value="">כל החודשים</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
                </select>
              </div>
              {isAdmin && (
                <div className="col-span-2">
                  <label className={lbl} htmlFor="f-apt">דירה (לפי הדירה שנרשמה בתנועה ולפי שיוכים פעילים)</label>
                  <select id="f-apt" name="apt" defaultValue={filters.apt} className={inp}>
                    <option value="">כל הדירות</option>
                    {aptSorted.map((n) => <option key={n} value={n}>דירה {n}</option>)}
                    <option value={NO_APT}>ללא שיוך</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-lg bg-brand-600 text-white text-sm py-2.5 min-h-[44px]">החל סינון</button>
              {filtered && <Link href="/finances" data-action="clear-filter" className="flex-1 text-center rounded-lg border border-gray-300 text-sm py-2.5 min-h-[44px] inline-flex items-center justify-center">נקה סינון</Link>}
            </div>
          </form>
        </details>
        <div data-section="tx-summary" className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
          <div className="font-semibold">{filtered ? "סיכום התוצאות המסוננות בלבד" : "סיכום כל התנועות"} <span className="font-normal text-xs text-gray-500">(אינו יתרת הקופה)</span></div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div>מספר תנועות: <b data-v="count">{sum.count}</b></div>
            <div>הפרש: <b data-v="net" className={sum.netAgorot < 0 ? "text-red-700" : "text-green-700"} dir="ltr">{ils(sum.netAgorot / 100)}</b></div>
            <div>סך הכנסות: <b data-v="income" className="text-green-700">{ils(sum.incomeAgorot / 100)}</b></div>
            <div>סך הוצאות: <b data-v="expense" className="text-red-700">{ils(sum.expenseAgorot / 100)}</b></div>
          </div>
          {sum.voided > 0 && <div className="text-xs text-gray-500">{sum.voided === 1 ? "תנועה מבוטלת אחת מוצגת" : `${sum.voided} תנועות מבוטלות מוצגות`} ברשימה ואינה נספרת בסכומים.</div>}
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        {tx.map((t: any) => {
          const voided = !!t.voided_at;
          return (
            <div key={t.id} id={`tx-${t.id}`} className="py-3 scroll-mt-4">
              <div className="flex items-center justify-between">
                <div className={voided ? "opacity-60" : ""}>
                  <div className={`font-semibold ${voided ? "line-through" : ""}`}>{t.description ?? t.categories?.name}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(t.date).toLocaleDateString("he-IL")}
                    {t.categories?.name ? ` · ${t.categories.name}` : ""}
                    {t.suppliers?.name ? ` · ${t.suppliers.name}` : ""}
                    {t.apartments?.apartment_number ? ` · דירה ${t.apartments.apartment_number}` : ""}
                    {t.fee_month ? ` · ועד ${t.fee_month}/${t.fee_year}` : ""}
                  </div>
                  {t.notes && <div className="text-xs text-gray-500">{t.notes}</div>}
                  {isAdmin && !voided && (allocated.get(t.id) ?? 0) > 0 && (
                    <div className="text-xs text-brand-700">שויך {ils(allocated.get(t.id))} מתוך {ils(t.amount)} · <Link href={`/payments/allocate?tx=${t.id}`} className="underline">פרטים</Link></div>
                  )}
                  {isAdmin && !voided && t.type === "income" && !t.fee_year && !(allocated.get(t.id) ?? 0) && (
                    <div className="text-xs"><Link href={`/payments/allocate?tx=${t.id}`} className="text-brand-700 underline">שייך לדירה ולחודשים</Link></div>
                  )}
                  {voided && <div className="text-xs text-red-700">בוטל: {t.void_reason}</div>}
                </div>
                <div className={`font-bold tabular-nums ${voided ? "text-gray-500 line-through" : t.type === "income" ? "text-green-700" : "text-red-700"}`}>
                  {t.type === "income" ? "+" : "-"}
                  {ils(t.amount)}
                </div>
              </div>

              {isAdmin && !voided && (
                <details className="mt-2">
                  <summary className="text-xs text-brand-600 cursor-pointer">עריכה / ביטול / היסטוריה</summary>
                  <div className="mt-2 space-y-3">
                    <ActionForm action={correctTransaction} keepOnSuccess className="space-y-2 border border-gray-100 rounded-lg p-2">
                      <div className="text-xs font-semibold">תיקון תנועה (נדרשת סיבה, והערך הקודם נשמר)</div>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="row_version" value={t.row_version} />
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className={lbl}>תאריך</label><input type="date" name="date" defaultValue={t.date} className={inp} required /></div>
                        <div><label className={lbl}>סכום</label><input type="number" step="0.01" min="0.01" name="amount" defaultValue={t.amount} className={inp} required /></div>
                      </div>
                      <input type="text" name="description" defaultValue={t.description ?? ""} placeholder="תיאור" className={inp} />
                      <div className="grid grid-cols-2 gap-2">
                        <select name="category_id" defaultValue={t.category_id ?? ""} className={inp}>
                          <option value="">ללא קטגוריה</option>
                          {catOptions}
                        </select>
                        <select name="supplier_id" defaultValue={t.supplier_id ?? ""} className={inp}>
                          <option value="">ללא ספק</option>
                          {supOptions}
                        </select>
                      </div>
                      <input type="text" name="notes" defaultValue={t.notes ?? ""} placeholder="הערה (גלויה לדיירים)" className={inp} />
                      <input type="text" name="reason" placeholder="סיבת התיקון (חובה)" className={inp} required minLength={3} />
                      <SubmitButton confirmText="לשמור את התיקון? הערך הקודם יישמר ביומן.">שמור תיקון</SubmitButton>
                    </ActionForm>

                    <ActionForm action={voidTransaction} className="space-y-2 border border-red-100 rounded-lg p-2">
                      <div className="text-xs font-semibold text-red-700">ביטול תנועה (לא נמחקת, רק לא נספרת ביתרה)</div>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="row_version" value={t.row_version} />
                      <input type="text" name="reason" placeholder="סיבת הביטול (חובה)" className={inp} required minLength={3} />
                      <SubmitButton className={btnDanger} confirmText={`לבטל את התנועה "${t.description ?? ""}" בסך ${ils(t.amount)}?`}>בטל תנועה</SubmitButton>
                    </ActionForm>

                    <div>
                      <div className="text-xs font-semibold mb-1">היסטוריית שינויים</div>
                      <AuditList entries={history.get(t.id) ?? []} names={names} showEntity={false} />
                    </div>
                  </div>
                </details>
              )}
              {isAdmin && voided && (
                <details className="mt-2">
                  <summary className="text-xs text-brand-600 cursor-pointer">היסטוריה</summary>
                  <div className="mt-2"><AuditList entries={history.get(t.id) ?? []} names={names} showEntity={false} /></div>
                </details>
              )}
            </div>
          );
        })}
        {!tx.length && (filtered
          ? <p data-state="no-results" className="text-gray-600 text-sm py-4">לא נמצאו תנועות התואמות את הסינון. נסה/י לשנות או <Link href="/finances" className="text-brand-700 underline">לנקות את הסינון</Link>.</p>
          : <p className="text-gray-500 text-sm py-4">אין עדיין תנועות רשומות.</p>)}
      </div>
    </div>
  );
}
