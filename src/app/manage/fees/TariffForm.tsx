"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { createTariff } from "@/lib/manage-actions";
import { inp, lbl, ils, monthName } from "@/components/ui";

type Apt = { id: string; number: string; legacy: number; current: number | null };

export default function TariffForm({ apartments, defaultMonth }: { apartments: Apt[]; defaultMonth: string }) {
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState(false);

  const targets = scope === "all" ? apartments : apartments.filter((a) => sel.has(a.id));
  const legacyGroups = Array.from(
    apartments.reduce((m, a) => m.set(a.legacy, [...(m.get(a.legacy) ?? []), a]), new Map<number, Apt[]>())
  ).filter(([amt]) => amt > 0);

  function toggle(id: string) {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
    setSummary(false);
  }

  const valid = Number(amount) > 0 && /^\d{4}-\d{2}$/.test(month) && reason.trim().length >= 2 && targets.length > 0;
  const [y, m] = month ? month.split("-").map(Number) : [0, 0];

  return (
    <ActionForm action={createTariff} className="space-y-3">
      <div className="text-xs text-gray-500">
        סכומים ישנים מהגיליון (ללא תאריך תחילה). לחיצה על סכום ממלאת את הטופס, ואתה בוחר בעצמך את חודש התחילה:
      </div>
      <div className="flex flex-wrap gap-2">
        {legacyGroups.map(([amt, apts]) => (
          <button
            type="button"
            key={amt}
            className="text-xs border border-brand-200 rounded-full px-3 py-1 text-brand-700"
            onClick={() => {
              setAmount(String(amt));
              setScope("selected");
              setSel(new Set(apts.map((a) => a.id)));
              setSummary(false);
            }}
          >
            {ils(amt)} · {apts.length} דירות
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>סכום חודשי (₪)</label>
          <input name="amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setSummary(false); }} className={inp} required />
        </div>
        <div>
          <label className={lbl}>תקף מחודש</label>
          <input name="from_month" type="month" value={month} placeholder={defaultMonth} onChange={(e) => { setMonth(e.target.value); setSummary(false); }} className={inp} required />
        </div>
      </div>

      <div>
        <label className={lbl}>חל על</label>
        <select name="scope" value={scope} onChange={(e) => { setScope(e.target.value as any); setSummary(false); }} className={inp}>
          <option value="all">כל הדירות</option>
          <option value="selected">דירות נבחרות</option>
        </select>
      </div>

      {scope === "selected" && (
        <div className="grid grid-cols-4 gap-1">
          {apartments.map((a) => (
            <label key={a.id} className={`text-center text-xs rounded-lg border px-1 py-1.5 cursor-pointer ${sel.has(a.id) ? "bg-brand-600 text-white border-brand-600" : "border-gray-300"}`}>
              <input type="checkbox" name="apartment_ids" value={a.id} checked={sel.has(a.id)} onChange={() => toggle(a.id)} className="hidden" />
              {a.number}
            </label>
          ))}
        </div>
      )}

      <input name="reason" value={reason} onChange={(e) => { setReason(e.target.value); setSummary(false); }} placeholder="סיבת השינוי (חובה)" className={inp} required />

      {!summary ? (
        <button type="button" disabled={!valid} onClick={() => setSummary(true)} className="btn-primary w-full text-sm py-1.5 disabled:opacity-50">
          הצג סיכום לפני שמירה
        </button>
      ) : (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1 text-sm">
          <div className="font-bold">סיכום לאישור</div>
          <div>סכום חדש: <b>{ils(Number(amount))}</b> לחודש</div>
          <div>תחילת תוקף: <b>{monthName(m)} {y}</b></div>
          <div>דירות מושפעות ({targets.length}): {targets.map((a) => a.number).join(", ")}</div>
          <div className="text-xs text-gray-600">
            לפי התעריף בחודש שמוצג למעלה, הדירות האלה משלמות כעת:{" "}
            {Array.from(new Set(targets.map((a) => (a.current == null ? "לא הוגדר" : ils(a.current))))).join(" / ")}
          </div>
          <div className="text-xs text-gray-600">התעריפים הקודמים נשמרים. חיובים שכבר נוצרו, ותשלומים שנרשמו, לא ישתנו ולא ישוכתבו. התעריף ישפיע רק על חיובים שייווצרו מחודש התחילה והלאה.</div>
          <div className="flex gap-2 pt-1">
            <SubmitButton>אשר ושמור תעריף</SubmitButton>
            <button type="button" className="w-full rounded-lg border border-gray-300 text-sm py-1.5" onClick={() => setSummary(false)}>חזרה לעריכה</button>
          </div>
        </div>
      )}
    </ActionForm>
  );
}
