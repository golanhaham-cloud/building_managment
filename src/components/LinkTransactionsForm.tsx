"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { inp } from "@/components/ui";
import type { ActionState } from "@/components/forms";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type Item = { id: string; label: string };

function Buttons({ count, onMode }: { count: number; onMode: (m: "link" | "unlink") => void }) {
  const { pending } = useFormStatus();
  const cls = "w-full rounded-lg text-sm py-2.5 min-h-[44px] aria-disabled:opacity-60 aria-disabled:cursor-wait";
  return (
    <div className="space-y-2">
      {pending && <p role="status" data-state="saving" className="text-sm text-brand-700">שומר את השיוך... אל תסגור/י את העמוד ואל תלחצ/י שוב.</p>}
      <button type="submit" aria-disabled={pending || undefined} onClick={(e) => { if (pending) e.preventDefault(); else onMode("link"); }} className={`${cls} bg-brand-600 text-white`}>
        {pending ? "שומר..." : `שייך את המסומנות${count ? ` (${count})` : ""} להוצאה הקבועה`}
      </button>
      <button type="submit" aria-disabled={pending || undefined} onClick={(e) => { if (pending) e.preventDefault(); else onMode("unlink"); }} className={`${cls} border border-gray-300 text-gray-800`}>
        בטל שיוך למסומנות
      </button>
    </div>
  );
}

// טופס שיוך המוני: הרשימה (children) נבנית בשרת; כאן בחירה, אימות, מצב שמירה והודעות שגיאה בעברית.
export default function LinkTransactionsForm({ action, items, keep, children }: { action: Action; items: Item[]; keep: Record<string, string>; children: React.ReactNode }) {
  const safe: Action = async (prev, fd) => {
    try { return await action(prev, fd); } catch (e) {
      // redirect של Next נזרק כחריגה ומטופל על ידי המסגרת; כל חריגה אחרת היא כשל אמיתי.
      if (e && typeof e === "object" && "digest" in e && String((e as any).digest).startsWith("NEXT_REDIRECT")) throw e;
      return { ok: false, message: "הפעולה לא הושלמה: ייתכן שיש בעיית חיבור. רענן/י את העמוד, בדוק/י אם השיוך נשמר, ורק אם לא נסה/י שוב." };
    }
  };
  const [state, formAction] = useFormState(safe, null as ActionState);
  const [count, setCount] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const mode = useRef<"link" | "unlink">("link");
  const inFlight = useRef(false);
  const errRef = useRef<HTMLDivElement>(null);

  const boxes = () => Array.from(ref.current?.querySelectorAll<HTMLInputElement>("input[name=tx]") ?? []);
  const recount = () => setCount(boxes().filter((b) => b.checked).length);
  useEffect(() => { inFlight.current = false; if (state && !state.ok) errRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [state]);

  const shown = err ?? (state && !state.ok ? state.message : null);
  return (
    <form ref={ref} action={formAction} noValidate data-form="link-tx" className="space-y-3"
      onChange={() => { recount(); if (err) setErr(null); }}
      onSubmit={(e) => {
        const fd = new FormData(ref.current!);
        let m: string | null = null;
        if (!fd.getAll("tx").length) m = "יש לסמן לפחות תנועה אחת";
        else if (mode.current === "link" && !String(fd.get("item") ?? "")) m = "יש לבחור הוצאה קבועה לשיוך";
        if (m) { e.preventDefault(); setErr(m); errRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
        if (inFlight.current) { e.preventDefault(); return; }
        inFlight.current = true;
      }}>
      {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="mode" ref={(el) => { if (el) el.value = mode.current; }} id="link-mode" />
      <div className="py-2 space-y-2 border-b border-gray-100">
        <label className="flex items-center gap-2 text-sm min-h-[44px]">
          <input type="checkbox" className="h-5 w-5" aria-label="סמן את כל התנועות המוצגות" onChange={(e) => { boxes().forEach((b) => (b.checked = e.target.checked)); recount(); }} />
          סמן הכול (המוצגות בלבד) · נבחרו <b data-v="selected">{count}</b>
        </label>
        <select name="item" className={inp} aria-label="הוצאה קבועה לשיוך" defaultValue="">
          <option value="">בחר/י הוצאה קבועה...</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
        {shown && <div ref={errRef} role="alert" data-error={err ? "client" : "server"} className="rounded-lg bg-red-50 text-red-800 text-sm p-2">{shown}</div>}
        <Buttons count={count} onMode={(m) => { mode.current = m; const h = document.getElementById("link-mode") as HTMLInputElement | null; if (h) h.value = m; }} />
      </div>
      {children}
    </form>
  );
}
