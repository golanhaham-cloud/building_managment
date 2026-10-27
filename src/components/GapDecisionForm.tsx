"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { inp, lbl } from "@/components/ui";
import { GAP_SUMMARY_ERROR, validateGapForm, type GapFormErrors } from "@/lib/gap-form";
import type { ActionState } from "@/components/forms";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
const sel = "w-full rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white min-h-[44px]";
const bad = "border-red-500 ring-1 ring-red-300";

function Submit({ confirming, onBack }: { confirming: string | null; onBack: () => void }) {
  const { pending } = useFormStatus();
  const cls = "w-full text-sm py-2.5 min-h-[44px] aria-disabled:opacity-60 aria-disabled:cursor-wait";
  return (
    <div className="space-y-2">
      {pending && <p role="status" className="text-sm text-brand-700" data-state="saving">שומר את ההחלטה... אל תסגור/י את העמוד.</p>}
      {confirming && !pending && (
        <p role="status" className="rounded-lg bg-amber-50 text-amber-900 text-sm p-2" data-state="confirm">
          לאישור: {confirming}. ההחלטה אינה תשלום ואינה משנה את הכספים. לחצ/י ״אשר ושמור״ כדי לשמור.
        </p>
      )}
      <button type="submit" aria-disabled={pending || undefined} aria-busy={pending || undefined} onClick={(e) => { if (pending) e.preventDefault(); }}
        className={`btn-primary ${cls}`}>
        {pending ? "שומר..." : confirming ? "אשר ושמור" : "שמור החלטה"}
      </button>
      {confirming && !pending && <button type="button" onClick={onBack} className="w-full rounded-lg border border-gray-300 text-sm py-2.5 min-h-[44px]">חזרה לעריכה</button>}
    </div>
  );
}

// טופס תיעוד החלטת ועד. הבדיקה בצד הלקוח מציגה הודעות בעברית מתחת לשדות (בלי להסתמך על בועת הדפדפן, שאינה מוצגת בנייד),
// והשגיאות שחוזרות מהשרת מוצגות בטופס. השמירה עצמה (הפעולה בשרת והפונקציות במסד) לא השתנתה.
export default function GapDecisionForm({ action, apartmentId, year, month, filters, apt, shortfallText, reductionRoom, verifiedRoom, defaultKind }: {
  action: Action; apartmentId: string; year: number; month: number; filters: { apt: string; from: string; to: string; all: string };
  apt: string; shortfallText: string; reductionRoom: string; verifiedRoom: string; defaultKind: "reduction" | "verified_debt";
}) {
  const safe: Action = async (prev, fd) => {
    try { return await action(prev, fd); } catch { return { ok: false, message: "הפעולה לא הושלמה, ייתכן שיש בעיית חיבור. בדוק/י את החיבור ונסה/י שוב. מה שהוזן נשמר בטופס." }; }
  };
  const [state, formAction] = useFormState(safe, null as ActionState);
  const [errors, setErrors] = useState<GapFormErrors>({});
  const [summary, setSummary] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const serverRef = useRef<HTMLParagraphElement>(null);
  const inFlight = useRef(false);
  const id = `gd-${apartmentId}-${year}-${month}`;

  useEffect(() => {
    inFlight.current = false;
    if (state && !state.ok) {
      setConfirming(null); // נשארים בטופס עם הערכים שהוזנו; המשתמש יכול לתקן ולנסות שוב
      serverRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state]);

  const read = () => {
    const f = ref.current!;
    return { amount: String((f.elements.namedItem("amount") as HTMLInputElement).value), reason: String((f.elements.namedItem("reason") as HTMLInputElement).value) };
  };

  return (
    <form ref={ref} action={formAction} noValidate className="space-y-2 mt-1" data-gap-form="" onChange={() => confirming && setConfirming(null)}
      onSubmit={(e) => {
        const errs = validateGapForm(read());
        if (errs.amount || errs.reason) {
          e.preventDefault();
          setErrors(errs); setSummary(true);
          const first = ref.current!.elements.namedItem(errs.amount ? "amount" : "reason") as HTMLInputElement;
          first.scrollIntoView({ block: "center", behavior: "smooth" });
          first.focus({ preventScroll: true });
          return;
        }
        setErrors({}); setSummary(false);
        // שלב אישור בתוך העמוד (לא חלון דפדפן, שעלול להיחסם בנייד ואז הלחיצה נראית כאילו אינה עושה דבר).
        if (!confirming) {
          e.preventDefault();
          const f = ref.current!;
          const kindEl = f.elements.namedItem("kind") as HTMLSelectElement;
          setConfirming(`${kindEl.options[kindEl.selectedIndex].text.replace(/\s*\(עד.*$/, "")} בסך ${read().amount.trim()} ₪ לדירה ${apt}, ${String(month).padStart(2, "0")}/${year}`);
          return;
        }
        if (inFlight.current) e.preventDefault(); else inFlight.current = true;
      }}>
      <input type="hidden" name="apartment_id" value={apartmentId} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      {(["apt", "from", "to", "all"] as const).map((k) => <input key={k} type="hidden" name={`f_${k}`} value={filters[k]} />)}
      <p className="text-xs text-gray-600">ברירת המחדל לכל פער היא ״לבירור״. תיעוד החלטה אינו תשלום, אינו יוצר הכנסה ואינו משנה חיובים או תשלומים. אם כבר קיימת החלטה מאותו סוג, היא תתעדכן והשינוי יישמר ביומן. פער פתוח לדירה {apt}: {shortfallText}.</p>
      <div><label className={lbl} htmlFor={`${id}-kind`}>סוג ההחלטה</label>
        <select id={`${id}-kind`} name="kind" className={sel} defaultValue={defaultKind}>
          <option value="reduction">הפחתה שאושרה (עד {reductionRoom})</option>
          <option value="verified_debt">חוב מאומת (עד {verifiedRoom})</option>
        </select></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl} htmlFor={`${id}-amount`}>סכום (₪)</label>
          <input id={`${id}-amount`} name="amount" inputMode="decimal" placeholder="0.00" className={`${inp} ${errors.amount ? bad : ""}`}
            aria-invalid={errors.amount ? true : undefined} aria-describedby={errors.amount ? `${id}-amount-err` : undefined}
            onChange={() => errors.amount && setErrors((x) => ({ ...x, amount: undefined }))} />
          {errors.amount && <p id={`${id}-amount-err`} role="alert" className="text-xs text-red-700 mt-0.5" data-error="amount">{errors.amount}</p>}
        </div>
        <div><label className={lbl} htmlFor={`${id}-rep`}>תאריך הדיווח (אם ידוע)</label><input id={`${id}-rep`} name="reported_on" type="date" className={inp} /></div>
      </div>
      <div>
        <label className={lbl} htmlFor={`${id}-reason`}>סיבה / אסמכתה</label>
        <input id={`${id}-reason`} name="reason" maxLength={500} placeholder="סיבה / אסמכתה (חובה)" className={`${inp} ${errors.reason ? bad : ""}`}
          aria-invalid={errors.reason ? true : undefined} aria-describedby={errors.reason ? `${id}-reason-err` : undefined}
          onChange={() => errors.reason && setErrors((x) => ({ ...x, reason: undefined }))} />
        {errors.reason && <p id={`${id}-reason-err`} role="alert" className="text-xs text-red-700 mt-0.5" data-error="reason">{errors.reason}</p>}
      </div>
      {summary && (errors.amount || errors.reason) && <p role="alert" className="rounded-lg bg-red-50 text-red-800 text-sm p-2" data-error="summary">{GAP_SUMMARY_ERROR}</p>}
      {state && !state.ok && <p ref={serverRef} role="alert" className="rounded-lg bg-red-50 text-red-800 text-sm p-2" data-error="server">{state.message}</p>}
      <Submit confirming={confirming} onBack={() => setConfirming(null)} />
    </form>
  );
}
