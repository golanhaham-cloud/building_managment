import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { addTransactionAction, correctTransaction, voidTransaction } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import AuditList from "@/components/AuditList";
import { userNameMap, type AuditEntry } from "@/lib/audit";
import { inp, lbl, btnDanger, ils } from "@/components/ui";
import Link from "next/link";

export default async function FinancesPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, type, date, amount, description, notes, category_id, supplier_id, row_version, voided_at, void_reason, fee_year, fee_month, categories(name), suppliers(name), apartments:source_apartment_id(apartment_number)")
    .eq("building_id", appUser?.building_id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const [{ data: categories }, { data: suppliers }] = isAdmin
    ? await Promise.all([
        supabase.from("categories").select("id, name, type").eq("building_id", appUser?.building_id).order("name"),
        supabase.from("suppliers").select("id, name").eq("building_id", appUser?.building_id).order("name"),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

  let history = new Map<string, AuditEntry[]>();
  let names = new Map<string, string>();
  if (isAdmin && tx?.length) {
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

  // כמה מכל הכנסה שויך לדירות/חודשים (ועד בלבד). השיוך אינו משנה את הסכום או את היתרה.
  const allocated = new Map<string, number>();
  if (isAdmin) {
    const { data: al } = await supabase.from("payment_allocations").select("transaction_id, amount").eq("building_id", appUser?.building_id).is("voided_at", null);
    for (const a of al ?? []) allocated.set((a as any).transaction_id, (allocated.get((a as any).transaction_id) ?? 0) + Number((a as any).amount));
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
        <Link href="/payments" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">
          תשלומי ועד ←
        </Link>
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

      <div className="card divide-y divide-gray-100">
        {tx?.map((t: any) => {
          const voided = !!t.voided_at;
          return (
            <div key={t.id} className="py-3">
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
        {!tx?.length && <p className="text-gray-500 text-sm py-4">אין עדיין תנועות רשומות.</p>}
      </div>
    </div>
  );
}
