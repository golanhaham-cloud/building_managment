"use client";

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { allocateExistingIncome, recordNewIncomeWithAllocations } from "@/lib/allocation-actions";
import { BASES, BASIS_LABELS, availableAfterAg, basisNeedsNote, fromAg, monthProgress, nextMonth, rowsTotalAg, toAg, toRpcItems, validateRows, type AllocRow, type Basis } from "@/lib/allocations";
import { inp, lbl, ils, monthName } from "@/components/ui";

export type Source = { id: string; date: string; amount: number; description: string | null; payment_method: string | null; allocated: number; available: number };
export type Apt = { id: string; number: string; floor: number };
export type Charges = Record<string, { net: number; paid: number }>; // "apt|year|month"
export type Initial = { apt?: string; year?: number; month?: number; tx?: string };

type Row = AllocRow & { auto: boolean };
let seq = 0;
const newKey = () => `r${++seq}`;

export default function AllocationForm({ mode, sources, apartments, charges, months, initial }: {
  mode: "existing" | "new"; sources: Source[]; apartments: Apt[]; charges: Charges; months: { year: number; month: number }[]; initial: Initial;
}) {
  const isNew = mode === "new";
  const [q, setQ] = useState("");
  const [txId, setTxId] = useState(initial.tx ?? "");
  const [newAmount, setNewAmount] = useState("");
  const lastMonth = months[months.length - 1] ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const blank = (over: Partial<Row> = {}): Row => ({
    key: newKey(), kind: "fee", apartment_id: initial.apt ?? "", year: initial.year ?? lastMonth.year, month: initial.month ?? lastMonth.month,
    purpose: "", amount: "", apartment_basis: "", months_basis: "", basis_note: "", auto: true, ...over,
  });
  const [rows, setRows] = useState<Row[]>(() => [blank()]);

  const source = sources.find((s) => s.id === txId);
  const availableAg = isNew ? toAg(newAmount) : source ? toAg(source.available) : 0;
  const total = rowsTotalAg(rows);
  const left = availableAfterAg(availableAg, rows);
  const problem = (!isNew && !source ? "יש לבחור הכנסה קיימת" : null) ?? (isNew && !(Number(newAmount) > 0) ? "יש להזין את סכום התשלום" : null) ?? validateRows(rows, availableAg);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = sources.filter((s) => s.available > 0);
    if (!t) return list.slice(0, 40);
    return list
      .filter((s) => `${s.description ?? ""} ${s.amount} ${new Date(s.date).toLocaleDateString("he-IL")} ${s.date}`.toLowerCase().includes(t))
      .slice(0, 40);
  }, [sources, q]);

  function suggest(r: Row, others: Row[]): string {
    if (r.kind !== "fee" || !r.apartment_id) return r.amount;
    const c = charges[`${r.apartment_id}|${r.year}|${r.month}`];
    const free = availableAfterAg(availableAg, others);
    const want = c ? Math.max(0, toAg(c.net) - toAg(c.paid)) : free;
    const v = Math.min(want || free, Math.max(0, free));
    return v > 0 ? String(fromAg(v)) : "";
  }
  function patch(key: string, p: Partial<Row>, resuggest = false) {
    setRows((rs) => rs.map((r) => {
      if (r.key !== key) return r;
      const n = { ...r, ...p };
      if (resuggest && n.auto) n.amount = suggest(n, rs.filter((x) => x.key !== key));
      return n;
    }));
  }
  function addMonth() {
    setRows((rs) => {
      const last = [...rs].reverse().find((r) => r.kind === "fee");
      const nm = last ? nextMonth(last.year, last.month) : { year: lastMonth.year, month: lastMonth.month };
      const r = blank({ apartment_id: last?.apartment_id ?? initial.apt ?? "", year: nm.year, month: nm.month, apartment_basis: last?.apartment_basis ?? "", months_basis: last?.months_basis ?? "", basis_note: last?.basis_note ?? "" });
      r.amount = suggest(r, rs);
      return [...rs, r];
    });
  }
  function addSpecial() {
    setRows((rs) => {
      const free = availableAfterAg(availableAg, rs);
      return [...rs, blank({ kind: "special", apartment_id: "", amount: free > 0 ? String(fromAg(free)) : "" })];
    });
  }

  const action = isNew ? recordNewIncomeWithAllocations : allocateExistingIncome;
  const sel = "w-full rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white min-h-[44px]";

  return (
    <ActionForm action={action} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="items" value={JSON.stringify(toRpcItems(rows))} />
      <input type="hidden" name="transaction_id" value={txId} />

      {isNew ? (
        <fieldset className="card space-y-2">
          <legend className="font-bold px-1">התשלום החדש (הכנסה אחת בקופה)</legend>
          <p className="text-xs text-gray-600">רק לתשלום שבאמת אינו מופיע בכספים, למשל מזומן. תיווצר הכנסה אחת בלבד, והשיוכים לחודשים מצביעים עליה.</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={lbl}>סכום ששולם</label><input name="amount" type="number" step="0.01" min="0.01" inputMode="decimal" className={inp} value={newAmount} onChange={(e) => setNewAmount(e.target.value)} required /></div>
            <div><label className={lbl}>תאריך קבלה</label><input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inp} required /></div>
          </div>
          <input name="description" aria-label="תיאור" placeholder="תיאור (למשל: מזומן מדירה 7)" className={inp} />
          <select name="method" aria-label="אמצעי תשלום" className={sel} defaultValue="">
            <option value="">אמצעי תשלום</option><option value="cash">מזומן</option><option value="check">שיק</option><option value="bank">העברה בנקאית</option><option value="app">ביט / פייבוקס</option>
          </select>
          <input name="notes" aria-label="הערה" placeholder="הערה (אופציונלי)" className={inp} />
        </fieldset>
      ) : (
        <fieldset className="card space-y-2">
          <legend className="font-bold px-1">1. בחר הכנסה קיימת</legend>
          <input type="search" aria-label="חיפוש הכנסה" placeholder="חיפוש לפי תיאור, סכום או תאריך" value={q} onChange={(e) => setQ(e.target.value)} className={inp} />
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200" role="radiogroup" aria-label="הכנסות קיימות">
            {filtered.length === 0 && <div className="p-3 text-sm text-gray-500">לא נמצאו הכנסות עם יתרה זמינה.</div>}
            {filtered.map((s) => (
              <label key={s.id} className={`flex items-start gap-2 p-2.5 cursor-pointer min-h-[44px] ${txId === s.id ? "bg-brand-50" : ""}`}>
                <input type="radio" name="source_pick" checked={txId === s.id} onChange={() => setTxId(s.id)} className="mt-1" />
                <span className="text-sm">
                  <b className="tabular-nums">{ils(s.amount)}</b> · {new Date(s.date).toLocaleDateString("he-IL")}
                  <span className="block text-xs text-gray-600">{s.description || "ללא תיאור"}</span>
                  <span className="block text-xs text-gray-500">שויך {ils(s.allocated)} · זמין {ils(s.available)}</span>
                </span>
              </label>
            ))}
          </div>
          {source && (
            <div className="rounded-lg bg-gray-50 p-2 text-sm">
              נבחר: <b>{ils(source.amount)}</b>, התקבל ב־{new Date(source.date).toLocaleDateString("he-IL")}. ההכנסה עצמה (סכום, תאריך, תיאור) לא תשתנה.
            </div>
          )}
        </fieldset>
      )}

      <div className="space-y-3">
        <h2 className="font-bold">{isNew ? "שיוך התשלום" : "2. שיוכים"}</h2>
        {rows.map((r, i) => {
          const c = r.kind === "fee" && r.apartment_id ? charges[`${r.apartment_id}|${r.year}|${r.month}`] : undefined;
          const amt = Number(r.amount) > 0 ? toAg(r.amount) : 0;
          const after = c ? monthProgress(c.net, c.paid + fromAg(amt)) : null;
          return (
            <fieldset key={r.key} className="card space-y-2">
              <legend className="px-1 text-sm font-semibold">שיוך {i + 1}</legend>
              <div className="flex gap-2">
                {(["fee", "special"] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={r.kind === k} onClick={() => setRows((rs) => rs.map((x) => x.key !== r.key ? x : { ...x, kind: k, ...(k === "special" ? { apartment_id: "", apartment_basis: "" as const, months_basis: "" as const, amount: x.amount || (availableAfterAg(availableAg, rs.filter((y) => y.key !== x.key)) > 0 ? String(fromAg(availableAfterAg(availableAg, rs.filter((y) => y.key !== x.key)))) : "") } : {}) }))}
                    className={`flex-1 rounded-lg border text-sm min-h-[44px] ${r.kind === k ? "border-brand-600 bg-brand-50 font-semibold" : "border-gray-300"}`}>
                    {k === "fee" ? "דמי ועד" : "מטרה מיוחדת"}
                  </button>
                ))}
              </div>
              {r.kind === "fee" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>דירה</label>
                      <select aria-label="דירה" className={sel} value={r.apartment_id} onChange={(e) => patch(r.key, { apartment_id: e.target.value }, true)}>
                        <option value="">בחר דירה</option>
                        {apartments.map((a) => <option key={a.id} value={a.id}>דירה {a.number} (קומה {a.floor})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>חודש כיסוי</label>
                      <select aria-label="חודש כיסוי" className={sel} value={`${r.year}-${r.month}`} onChange={(e) => { const [y, m] = e.target.value.split("-").map(Number); patch(r.key, { year: y, month: m }, true); }}>
                        {months.map((m) => <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{monthName(m.month)} {m.year}</option>)}
                      </select>
                    </div>
                  </div>
                  {r.apartment_id && (
                    <div className="text-xs text-gray-600" aria-live="polite">
                      {c ? <>חיוב {ils(c.net)} · נרשם עד כה {ils(c.paid)}{amt > 0 && after && (
                        <span className={after.state === "partial" ? "text-amber-700 font-semibold" : after.state === "full" ? "text-green-700" : ""}>
                          {" "}· אחרי השיוך: נרשם {ils(c.paid + fromAg(amt))} מתוך {ils(c.net)} ({after.label}){amt + toAg(c.paid) > toAg(c.net) ? " – גבוה מהחיוב" : ""}
                        </span>)}</> : <span className="text-amber-700">אין חיוב לחודש זה בדירה זו. יש ליצור חיובים לחודש לפני השיוך.</span>}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className={lbl}>מטרה מיוחדת (אינה דמי ועד)</label>
                  <input aria-label="מטרה מיוחדת" className={inp} placeholder="למשל: שיפור מראה הבניין" value={r.purpose} onChange={(e) => patch(r.key, { purpose: e.target.value })} />
                  <p className="text-xs text-gray-500 mt-1">לא מכסה חיוב חודשי ולא משנה סטטוס של חודש. הסכום נספר פעם אחת בלבד בכספים.</p>
                </div>
              )}
              <div>
                <label className={lbl}>סכום לשיוך</label>
                <input aria-label="סכום לשיוך" type="number" step="0.01" min="0.01" inputMode="decimal" className={inp} value={r.amount} onChange={(e) => patch(r.key, { amount: e.target.value, auto: false })} />
              </div>
              {r.kind === "fee" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={lbl}>בסיס לזהות הדירה</label>
                    <select aria-label="בסיס לזהות הדירה" className={sel} value={r.apartment_basis} onChange={(e) => patch(r.key, { apartment_basis: e.target.value as Basis })}>
                      <option value="">בחר בסיס</option>{BASES.map((b) => <option key={b} value={b}>{BASIS_LABELS[b]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>בסיס לחודשי הכיסוי</label>
                    <select aria-label="בסיס לחודשי הכיסוי" className={sel} value={r.months_basis} onChange={(e) => patch(r.key, { months_basis: e.target.value as Basis })}>
                      <option value="">בחר בסיס</option>{BASES.map((b) => <option key={b} value={b}>{BASIS_LABELS[b]}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <input aria-label="הערה לבסיס השיוך" className={inp} placeholder={basisNeedsNote(r.apartment_basis) || basisNeedsNote(r.months_basis) ? "הערה (חובה בשיוך משוער או שטרם הובהר)" : "הערה (אופציונלי)"} value={r.basis_note} onChange={(e) => patch(r.key, { basis_note: e.target.value })} />
              {r.kind === "fee" && <p className="text-xs text-gray-500">אישור מי שילם עבור איזו דירה אינו מאשר אוטומטית את החודשים, ולהפך. כל בסיס נשמר בנפרד.</p>}
              {rows.length > 1 && <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="text-sm text-red-700 min-h-[44px]">הסר שיוך זה</button>}
            </fieldset>
          );
        })}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={addMonth} className="rounded-lg border border-brand-600 text-brand-700 text-sm min-h-[44px]">+ הוסף חודש</button>
          <button type="button" onClick={addSpecial} className="rounded-lg border border-gray-300 text-sm min-h-[44px]">+ מטרה מיוחדת</button>
        </div>
      </div>

      <div className="card space-y-1 text-sm" aria-live="polite">
        <div>סכום מקור: <b>{ils(fromAg(isNew ? availableAg : source ? toAg(source.available) : 0))}</b>{!isNew && source && source.allocated > 0 ? <span className="text-gray-500"> (זמין, כבר שויכו {ils(source.allocated)})</span> : null}</div>
        <div>ישויך עכשיו: <b>{ils(fromAg(total))}</b></div>
        <div className={left < 0 ? "text-red-700 font-semibold" : ""}>יתרה זמינה אחרי השמירה: <b>{ils(fromAg(left))}</b></div>
        <div className="text-xs text-gray-600">{isNew ? "תיווצר הכנסה אחת בקופה." : "לא תיווצר הכנסה חדשה, ויתרת הקופה לא תשתנה."} חודש שנרשם בו סכום חלקי אינו מסומן כתשלום מלא ואינו מסומן "נבדק והושלם".</div>
      </div>

      {problem ? (
        <>
          <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-2" role="status">{problem}</p>
          <button type="button" disabled className="btn-primary w-full text-sm py-2.5 min-h-[44px] opacity-50">{isNew ? "רשום תשלום ושייך" : "שמור שיוכים"}</button>
        </>
      ) : (
        <SubmitButton>{isNew ? "רשום תשלום ושייך" : "שמור שיוכים"}</SubmitButton>
      )}
    </ActionForm>
  );
}
