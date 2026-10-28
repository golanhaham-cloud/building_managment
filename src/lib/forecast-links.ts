// היסטוריית תשלומים להוצאה קבועה: מבוססת רק על שיוך ידני מפורש (transactions.forecast_item_id).
// אין התאמה לפי סכום, קטגוריה, ספק או מילים בתיאור. תצוגה בלבד.

export type LinkedTx = { id: string; date: string; amount: number | string; description?: string | null; forecast_item_id?: string | null; created_at?: string | null; voided_at?: string | null };

export type ItemHistory = { rows: LinkedTx[]; count: number; totalAgorot: number };

// מקבץ לפי סעיף; מהחדש לישן (תאריך, ואז זמן יצירה). תנועות מבוטלות אינן נכללות.
export function groupByItem(rows: LinkedTx[]): Map<string, ItemHistory> {
  const out = new Map<string, ItemHistory>();
  for (const t of rows) {
    if (!t.forecast_item_id || t.voided_at) continue;
    const h = out.get(t.forecast_item_id) ?? { rows: [], count: 0, totalAgorot: 0 };
    h.rows.push(t);
    h.count++;
    h.totalAgorot += Math.round(Number(t.amount) * 100);
    out.set(t.forecast_item_id, h);
  }
  out.forEach((h) => h.rows.sort((a, b) => (a.date === b.date ? String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) : a.date < b.date ? 1 : -1)));
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// מזהי תנועות מהטופס: ייחודיים, תקינים, עד 200.
export function parseTxIds(raw: string[]): { ids: string[]; error: string | null } {
  const ids = Array.from(new Set(raw.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return { ids, error: "יש לסמן לפחות תנועה אחת" };
  if (ids.some((x) => !UUID_RE.test(x))) return { ids: [], error: "מזהה תנועה לא תקין. רענן/י את העמוד ונסה/י שוב" };
  if (ids.length > 200) return { ids: [], error: "אפשר לשייך עד 200 תנועות בבת אחת" };
  return { ids, error: null };
}

export function isUuid(s: string): boolean { return UUID_RE.test(s); }

export type LinkFilters = { q: string; cat: string; show: "unlinked" | "linked" | "all" };
export function parseLinkFilters(sp: Record<string, string | string[] | undefined>): LinkFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const show = one(sp.show);
  return { q: one(sp.q).trim().slice(0, 100), cat: one(sp.cat).trim(), show: show === "linked" || show === "all" ? show : "unlinked" };
}
