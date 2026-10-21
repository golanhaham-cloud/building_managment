"use client";

import { useMemo, useState } from "react";
import { importTransactions } from "@/lib/actions";

type Apt = { id: string; number: string; names: string[] };
type Row = {
  include: boolean;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  apartmentId: string;
  markPayment: boolean;
};

const NONE = -1;

function toIsoDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return `${y}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  let s = String(v ?? "").trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) neg = true;
  if (s.includes("-")) neg = true;
  s = s.replace(/[^\d.,]/g, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

const STOP = new Set(["משפחת", "משפחה", "ועד", "בית", "העברה", "תשלום", "דיירים", "דייר", "ליבנה"]);

function tokens(s: string): string[] {
  return s
    .replace(/[^֐-׿a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^ו(?=.{3,})/, ""))
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function guessApartment(desc: string, apts: Apt[]): string {
  const dt = new Set(tokens(desc));
  let best = "";
  let bestScore = 0;
  let tie = false;
  for (const a of apts) {
    const nt = new Set(a.names.flatMap(tokens));
    let score = 0;
    nt.forEach((t) => {
      if (dt.has(t)) score++;
    });
    if (score > bestScore) {
      best = a.id;
      bestScore = score;
      tie = false;
    } else if (score === bestScore && score > 0) {
      tie = true;
    }
  }
  return bestScore > 0 && !tie ? best : "";
}

export default function ImportClient({ apartments }: { apartments: Apt[] }) {
  const [grid, setGrid] = useState<unknown[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [dateCol, setDateCol] = useState(NONE);
  const [descCol, setDescCol] = useState(NONE);
  const [amountCol, setAmountCol] = useState(NONE);
  const [debitCol, setDebitCol] = useState(NONE);
  const [creditCol, setCreditCol] = useState(NONE);
  const [mode, setMode] = useState<"single" | "split">("single");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const headers = useMemo(
    () => (grid?.[headerRow] ?? []).map((h, i) => String(h ?? "").trim() || `עמודה ${i + 1}`),
    [grid, headerRow]
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setMsg("");
    setRows(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
      const clean = data.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
      setGrid(clean);
      setFileName(f.name);
      // guess header row: first row with at least 3 non-empty text cells
      let hr = 0;
      for (let i = 0; i < Math.min(clean.length, 15); i++) {
        const filled = clean[i].filter((c) => typeof c === "string" && c.trim() !== "").length;
        if (filled >= 3) {
          hr = i;
          break;
        }
      }
      setHeaderRow(hr);
      const hs = clean[hr].map((h) => String(h ?? "").trim());
      const find = (re: RegExp) => hs.findIndex((h) => re.test(h));
      setDateCol(find(/תאריך/));
      setDescCol(find(/תיאור|פרטים|הפעולה|אסמכתא|שם/));
      setAmountCol(find(/סכום|₪/));
      setDebitCol(find(/חובה/));
      setCreditCol(find(/זכות/));
      if (find(/חובה/) >= 0 && find(/זכות/) >= 0) setMode("split");
    } catch {
      setMsg("לא הצלחתי לקרוא את הקובץ. נסה לשמור אותו כ-CSV או Excel (xlsx).");
    }
  }

  function buildPreview() {
    if (!grid) return;
    if (dateCol === NONE || descCol === NONE || (mode === "single" ? amountCol === NONE : debitCol === NONE && creditCol === NONE)) {
      setMsg("יש לבחור עמודת תאריך, תיאור וסכום.");
      return;
    }
    setMsg("");
    const out: Row[] = [];
    for (const r of grid.slice(headerRow + 1)) {
      const date = toIsoDate(r[dateCol]);
      if (!date) continue;
      let amt: number | null = null;
      if (mode === "single") {
        amt = toNumber(r[amountCol]);
      } else {
        const d = debitCol !== NONE ? toNumber(r[debitCol]) : null;
        const c = creditCol !== NONE ? toNumber(r[creditCol]) : null;
        if (c && Math.abs(c) > 0) amt = Math.abs(c);
        else if (d && Math.abs(d) > 0) amt = -Math.abs(d);
      }
      if (amt === null || amt === 0) continue;
      const description = String(r[descCol] ?? "").trim();
      const type = amt > 0 ? "income" : "expense";
      const apartmentId = type === "income" ? guessApartment(description, apartments) : "";
      out.push({
        include: true,
        date,
        description,
        amount: Math.abs(amt),
        type,
        apartmentId,
        markPayment: !!apartmentId,
      });
    }
    if (!out.length) setMsg("לא נמצאו תנועות. בדוק את בחירת העמודות.");
    setRows(out);
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs!.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!rows) return;
    const chosen = rows.filter((r) => r.include);
    if (!chosen.length) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await importTransactions(
        chosen.map((r) => ({
          date: r.date,
          description: r.description,
          amount: r.amount,
          type: r.type,
          apartment_id: r.apartmentId || null,
          mark_payment: r.markPayment && r.type === "income" && !!r.apartmentId,
        }))
      );
      setMsg(`נשמרו ${res.inserted} תנועות. דולגו ${res.skipped} תנועות שכבר קיימות.` + (res.unlinked ? ` ל-${res.unlinked} תשלומים לא נוצר חיוב ועד באותו חודש, ולכן הם נרשמו כהכנסה בלבד, בלי עדכון עמוד תשלומי הוועד.` : ""));
      setRows(null);
      setGrid(null);
    } catch (e: any) {
      setMsg("שגיאה בשמירה: " + (e?.message ?? ""));
    }
    setBusy(false);
  }

  const sel = "w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white";
  const colSelect = (label: string, val: number, set: (n: number) => void) => (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <select className={sel} value={val} onChange={(e) => set(Number(e.target.value))}>
        <option value={NONE}>— בחר —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <p className="text-sm text-gray-600">
          הורד מאתר הבנק את תנועות החשבון כקובץ Excel או CSV והעלה אותו כאן. המערכת לא מתחברת לבנק, והקובץ נקרא בדפדפן שלך בלבד.
        </p>
        <input type="file" accept=".csv,.xls,.xlsx" onChange={onFile} className="text-sm" />
        {fileName && <div className="text-xs text-gray-400">{fileName}</div>}
      </div>

      {grid && !rows && (
        <div className="card space-y-3">
          <div className="font-semibold text-sm">התאמת עמודות</div>
          <label className="block text-sm">
            <span className="text-gray-600">שורת הכותרות</span>
            <select className={sel} value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
              {grid.slice(0, 15).map((r, i) => (
                <option key={i} value={i}>
                  שורה {i + 1}: {r.slice(0, 4).map((c) => String(c)).join(" | ")}
                </option>
              ))}
            </select>
          </label>
          {colSelect("תאריך", dateCol, setDateCol)}
          {colSelect("תיאור / שם המפקיד", descCol, setDescCol)}
          <div className="flex gap-3 text-sm">
            <label>
              <input type="radio" checked={mode === "single"} onChange={() => setMode("single")} /> עמודת סכום אחת (עם סימן)
            </label>
            <label>
              <input type="radio" checked={mode === "split"} onChange={() => setMode("split")} /> חובה וזכות בנפרד
            </label>
          </div>
          {mode === "single" ? (
            colSelect("סכום", amountCol, setAmountCol)
          ) : (
            <>
              {colSelect("חובה (הוצאה)", debitCol, setDebitCol)}
              {colSelect("זכות (הכנסה)", creditCol, setCreditCol)}
            </>
          )}
          <button className="btn-primary w-full text-sm py-2" onClick={buildPreview}>
            הצג תצוגה מקדימה
          </button>
        </div>
      )}

      {rows && (
        <div className="card space-y-3">
          <div className="font-semibold text-sm">תצוגה מקדימה ({rows.filter((r) => r.include).length} תנועות)</div>
          <p className="text-xs text-gray-500">
            בהכנסות אפשר לשייך דירה, ואז התשלום יתעדכן גם בעמוד תשלומי הוועד לחודש התנועה. תנועות זהות שכבר קיימות ידולגו.
          </p>
          <div className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <div key={i} className="py-2 space-y-1">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} className="mt-1" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{r.description || "(ללא תיאור)"}</div>
                    <div className="text-xs text-gray-400">{r.date}</div>
                  </div>
                  <div className={`font-bold tabular-nums text-sm ${r.type === "income" ? "text-status-paid" : "text-status-unpaid"}`}>
                    {r.type === "income" ? "+" : "-"}
                    {r.amount.toLocaleString("he-IL")}
                  </div>
                </label>
                {r.type === "income" && (
                  <div className="flex items-center gap-2 pr-6">
                    <select className={sel} value={r.apartmentId} onChange={(e) => update(i, { apartmentId: e.target.value, markPayment: !!e.target.value })}>
                      <option value="">ללא שיוך לדירה</option>
                      {apartments.map((a) => (
                        <option key={a.id} value={a.id}>
                          דירה {a.number} · {a.names[0] ?? ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-primary flex-1 text-sm py-2" disabled={busy} onClick={save}>
              {busy ? "שומר..." : "שמור תנועות"}
            </button>
            <button className="flex-1 rounded-lg border border-gray-300 text-sm py-2" onClick={() => setRows(null)}>
              חזרה
            </button>
          </div>
        </div>
      )}

      {msg && <div className="card text-sm">{msg}</div>}
    </div>
  );
}
