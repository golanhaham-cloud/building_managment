"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { inp } from "@/components/ui";
import { validateVoidReason } from "@/lib/allocations";
import type { ActionState } from "@/components/forms";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
const SLOW_MS = 12000;

function Buttons({ confirming, onBack, slow }: { confirming: boolean; onBack: () => void; slow: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="space-y-2">
      {pending && <p role="status" className="text-sm text-brand-700" data-state="saving">מבטל את ההקצאה... אל תסגור/י את העמוד ואל תלחצ/י שוב.</p>}
      {pending && slow && <p role="status" className="text-sm text-amber-800" data-state="slow">הפעולה נמשכת זמן רב. אם העמוד לא מתעדכן, רענן/י אותו ובדוק/י אם ההקצאה בוטלה לפני שתנסה/י שוב.</p>}
      <button type="submit" aria-disabled={pending || undefined} aria-busy={pending || undefined} onClick={(e) => { if (pending) e.preventDefault(); }}
        className="w-full rounded-lg bg-red-700 text-white text-sm py-2.5 min-h-[44px] aria-disabled:opacity-60 aria-disabled:cursor-wait">
        {pending ? "מבטל..." : confirming ? "אשר ביטול" : "בטל הקצאה"}
      </button>
      {confirming && !pending && <button type="button" onClick={onBack} className="w-full rounded-lg border border-gray-300 text-sm py-2.5 min-h-[44px]">חזרה</button>}
    </div>
  );
}

// ביטול הקצאה: סיבה חובה, אישור בתוך העמוד (לא חלון דפדפן שעלול להיחסם בנייד), מצב טעינה, והודעות שגיאה בעברית.
// הביטול עצמו (הפעולה בשרת והפונקציה במסד) לא השתנה: משחרר רק את הסכום שהוקצה.
export default function VoidAllocationForm({ action, id, label }: { action: Action; id: string; label: string }) {
  const safe: Action = async (prev, fd) => {
    try { return await action(prev, fd); } catch {
      return { ok: false, message: "הפעולה לא הושלמה: ייתכן שיש בעיית חיבור או שהאתר עודכן בזמן שהעמוד היה פתוח. רענן/י את העמוד, בדוק/י אם ההקצאה בוטלה, ורק אם לא נסה/י שוב." };
    }
  };
  const [state, formAction] = useFormState(safe, null as ActionState);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [slow, setSlow] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const serverRef = useRef<HTMLParagraphElement>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inFlight.current = false; clearTimeout(timer.current); setSlow(false);
    if (state && !state.ok) { setConfirming(false); serverRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }, [state]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const input = () => ref.current!.elements.namedItem("reason") as HTMLInputElement;

  return (
    <form ref={ref} action={formAction} noValidate data-void-form="" className="space-y-2 border border-red-100 rounded-lg p-2"
      onChange={() => confirming && setConfirming(false)}
      onSubmit={(e) => {
        const err = validateVoidReason(input().value);
        if (err) { e.preventDefault(); setError(err); input().scrollIntoView({ block: "center", behavior: "smooth" }); input().focus({ preventScroll: true }); return; }
        setError(null);
        if (!confirming) { e.preventDefault(); setConfirming(true); return; }
        if (inFlight.current) { e.preventDefault(); return; }
        inFlight.current = true;
        timer.current = setTimeout(() => setSlow(true), SLOW_MS);
      }}>
      <div className="text-xs font-semibold text-red-800">ביטול הקצאה: משחרר רק את הסכום שהוקצה. ההכנסה המקורית נשארת בכספים ללא שינוי.</div>
      <input type="hidden" name="id" value={id} />
      <div>
        <input name="reason" aria-label="סיבת הביטול" placeholder="סיבת הביטול (חובה)" maxLength={500}
          className={`${inp} ${error ? "border-red-500 ring-1 ring-red-300" : ""}`} aria-invalid={error ? true : undefined}
          onChange={() => error && setError(null)} />
        {error && <p role="alert" className="text-xs text-red-700 mt-0.5" data-error="reason">{error}</p>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 text-red-800 text-sm p-2" data-error="summary">לא ניתן לבטל: יש להזין סיבת ביטול.</p>}
      {confirming && <p role="status" className="rounded-lg bg-amber-50 text-amber-900 text-sm p-2" data-state="confirm">לאישור ביטול ההקצאה: {label}. ההכנסה המקורית לא תיפגע והסכום יחזור להיות זמין לשיוך.</p>}
      {state && !state.ok && <p ref={serverRef} role="alert" className="rounded-lg bg-red-50 text-red-800 text-sm p-2" data-error="server">{state.message}</p>}
      <Buttons confirming={confirming} onBack={() => setConfirming(false)} slow={slow} />
    </form>
  );
}
