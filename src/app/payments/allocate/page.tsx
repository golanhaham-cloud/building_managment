import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import AllocationForm, { type Apt, type Charges, type Source } from "@/components/AllocationForm";
import { ActionForm, SubmitButton } from "@/components/forms";
import { updateAllocationBasis, voidAllocation } from "@/lib/allocation-actions";
import { BASES, BASIS_LABELS, basisIsConfirmed } from "@/lib/allocations";
import { inp, lbl, ils, monthName } from "@/components/ui";
import Link from "next/link";
import DoneBanner from "@/components/DoneBanner";
import VoidAllocationForm from "@/components/VoidAllocationForm";

export const dynamic = "force-dynamic";

const sel = "w-full rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white min-h-[44px]";

function BasisBadge({ label, basis }: { label: string; basis: string | null }) {
  if (!basis) return null;
  const ok = basisIsConfirmed(basis);
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
      {label}: {BASIS_LABELS[basis as keyof typeof BASIS_LABELS] ?? basis}{ok ? "" : " (לא מאושר)"}
    </span>
  );
}

export default async function AllocatePage({ searchParams }: { searchParams: { mode?: string; apt?: string; year?: string; month?: string; tx?: string; done?: string } }) {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-xl font-extrabold">שיוך הכנסה לדירה ולחודשים</h1>
        <div className="card text-sm">המסך זמין לוועד בלבד.</div>
        <Link href="/payments" className="text-brand-700 inline-flex items-center min-h-[44px]">→ חזרה לתשלומי ועד</Link>
      </div>
    );
  }
  const supabase = createClient();
  const mode = searchParams.mode === "new" ? "new" : "existing";

  const { data: aptRows } = await supabase.from("apartments").select("id, floor, apartment_number").eq("building_id", appUser.building_id);
  const apartments: Apt[] = [...(aptRows ?? [])]
    .sort((a: any, b: any) => Number(a.apartment_number) - Number(b.apartment_number))
    .map((a: any) => ({ id: a.id, number: String(a.apartment_number), floor: a.floor }));
  const aptIds = apartments.map((a) => a.id);

  const [{ data: src }, { data: mp }, { data: adj }, { data: allocs }] = await Promise.all([
    supabase.rpc("income_sources"),
    supabase.from("monthly_payments").select("apartment_id, year, month, amount_due, amount_paid").in("apartment_id", aptIds),
    supabase.from("fee_adjustments").select("apartment_id, year, month, amount").eq("building_id", appUser.building_id).is("voided_at", null),
    supabase
      .from("payment_allocations")
      .select("id, kind, fee_year, fee_month, purpose, amount, apartment_basis, months_basis, basis_note, voided_at, void_reason, created_at, transactions:transaction_id(date, amount, description), apartments:apartment_id(apartment_number)")
      .eq("building_id", appUser.building_id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const sources: Source[] = (src ?? []).map((s: any) => ({
    id: s.id, date: s.date, amount: Number(s.amount), description: s.description, payment_method: s.payment_method, allocated: Number(s.allocated), available: Number(s.available),
  }));
  const adjBy = new Map<string, number>();
  for (const a of adj ?? []) {
    const k = `${a.apartment_id}|${a.year}|${a.month}`;
    adjBy.set(k, (adjBy.get(k) ?? 0) + Number(a.amount));
  }
  const charges: Charges = {};
  const monthSet = new Set<string>();
  for (const m of mp ?? []) {
    const k = `${m.apartment_id}|${m.year}|${m.month}`;
    charges[k] = { net: Number(m.amount_due) + (adjBy.get(k) ?? 0), paid: Number(m.amount_paid) };
    monthSet.add(`${m.year}-${m.month}`);
  }
  const months = Array.from(monthSet).map((k) => { const [year, month] = k.split("-").map(Number); return { year, month }; })
    .sort((a, b) => a.year - b.year || a.month - b.month);

  const initial = {
    apt: aptIds.includes(searchParams.apt ?? "") ? searchParams.apt : undefined,
    year: Number(searchParams.year) || undefined,
    month: Number(searchParams.month) || undefined,
    tx: sources.some((s) => s.id === searchParams.tx) ? searchParams.tx : undefined,
  };

  const [doneCode, doneN] = String(searchParams.done ?? "").split(".");
  const doneText =
    doneCode === "allocated" ? `נשמרו ${Number(doneN) || 0} שיוכים. ההכנסה בקופה ויתרת הקופה לא השתנו.`
    : doneCode === "created" ? `נרשמה הכנסה אחת בקופה ונשמרו ${Number(doneN) || 0} שיוכים.`
    : doneCode === "duplicate" ? "התשלום כבר נרשם (שמירה כפולה נמנעה)."
    : doneCode === "voided" ? "ההקצאה בוטלה והסכום חזר להיות זמין במקור. ההכנסה המקורית לא השתנתה."
    : doneCode === "basis" ? "בסיס השיוך עודכן (נשמר ביומן)."
    : null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">שיוך הכנסה לדירה ולחודשים</h1>
        <Link href="/payments" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">תשלומי ועד ←</Link>
      </div>
      {doneText && <DoneBanner text={doneText} keep={mode === "new" ? "mode=new" : ""} />}

      <div className="card text-sm space-y-1">
        <p>שיוך מצביע על הכנסה שכבר קיימת בכספים. הוא <b>אינו יוצר הכנסה נוספת</b>, אינו משנה את סכום ההכנסה, תאריך הקבלה או התיאור שלה, ואינו משנה את יתרת הקופה.</p>
        <p className="text-gray-600">הכנסה אחת יכולה לכסות כמה חודשים או דירות, ועד לסכומה בלבד.</p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="tablist">
        <Link role="tab" aria-selected={mode === "existing"} href="/payments/allocate" className={`text-center rounded-lg border min-h-[44px] flex items-center justify-center text-sm ${mode === "existing" ? "border-brand-600 bg-brand-50 font-semibold" : "border-gray-300"}`}>הכנסה קיימת בכספים</Link>
        <Link role="tab" aria-selected={mode === "new"} href="/payments/allocate?mode=new" className={`text-center rounded-lg border min-h-[44px] flex items-center justify-center text-sm ${mode === "new" ? "border-brand-600 bg-brand-50 font-semibold" : "border-gray-300"}`}>תשלום חדש (מזומן ועוד)</Link>
      </div>

      <AllocationForm key={mode} mode={mode} sources={sources} apartments={apartments} charges={charges} months={months} initial={initial} />

      <section className="card space-y-3">
        <h2 className="font-bold">שיוכים שנשמרו</h2>
        {(allocs ?? []).length === 0 && <p className="text-sm text-gray-500">עדיין לא נשמרו שיוכים.</p>}
        {(allocs ?? []).map((a: any) => {
          const voided = !!a.voided_at;
          return (
            <div key={a.id} className="border-t border-gray-100 pt-3 first:border-0 first:pt-0">
              <div className={voided ? "opacity-60" : ""}>
                <div className={`font-semibold ${voided ? "line-through" : ""}`}>
                  {ils(a.amount)} · {a.kind === "fee" ? `דמי ועד · דירה ${a.apartments?.apartment_number} · ${monthName(a.fee_month)} ${a.fee_year}` : `מטרה מיוחדת: ${a.purpose}`}
                </div>
                <div className="text-xs text-gray-600">
                  מקור: {ils(a.transactions?.amount)} שהתקבל ב־{a.transactions?.date ? new Date(a.transactions.date).toLocaleDateString("he-IL") : "—"}{a.transactions?.description ? ` · ${a.transactions.description}` : ""}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <BasisBadge label="דירה" basis={a.apartment_basis} />
                  <BasisBadge label="חודשים" basis={a.months_basis} />
                </div>
                {a.basis_note && <div className="text-xs text-gray-600 mt-1">הערה: {a.basis_note}</div>}
                {voided && <div className="text-xs text-red-700">בוטל: {a.void_reason}</div>}
              </div>
              {!voided && (
                <details className="mt-1">
                  <summary className="text-xs text-brand-600 cursor-pointer min-h-[44px] flex items-center">עדכון בסיס / ביטול הקצאה</summary>
                  <div className="space-y-3 mt-2">
                    <ActionForm action={updateAllocationBasis} keepOnSuccess className="space-y-2 border border-gray-100 rounded-lg p-2">
                      <div className="text-xs font-semibold">עדכון בסיס והערה (הסכום, הדירה והחודש אינם משתנים)</div>
                      <input type="hidden" name="id" value={a.id} />
                      {a.apartments && (
                        <div><label className={lbl}>בסיס לזהות הדירה</label>
                          <select name="apartment_basis" className={sel} defaultValue={a.apartment_basis ?? ""}>{BASES.map((b) => <option key={b} value={b}>{BASIS_LABELS[b]}</option>)}</select></div>
                      )}
                      {a.kind === "fee" && (
                        <div><label className={lbl}>בסיס לחודשי הכיסוי</label>
                          <select name="months_basis" className={sel} defaultValue={a.months_basis ?? ""}>{BASES.map((b) => <option key={b} value={b}>{BASIS_LABELS[b]}</option>)}</select></div>
                      )}
                      <input name="basis_note" aria-label="הערה" className={inp} defaultValue={a.basis_note ?? ""} placeholder="הערה (חובה בשיוך משוער או שטרם הובהר)" />
                      <input name="reason" aria-label="סיבת השינוי" className={inp} placeholder="סיבת השינוי (חובה)" required minLength={3} />
                      <SubmitButton>עדכן בסיס</SubmitButton>
                    </ActionForm>
                    <VoidAllocationForm action={voidAllocation} id={a.id}
                      label={`${ils(a.amount)} · ${a.kind === "fee" ? `דירה ${a.apartments?.apartment_number}, ${monthName(a.fee_month)} ${a.fee_year}` : `מטרה מיוחדת: ${a.purpose}`}`} />
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
