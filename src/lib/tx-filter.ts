// סינון וחיפוש ברשימת התנועות (תצוגה בלבד). לא משנה נתונים ולא את יתרת הקופה.
// הסיכומים מחושבים על כל התוצאות המסוננות (לא על שורות שנטענו למסך), בלי תנועות מבוטלות.

export type TxRow = {
  id: string;
  type: "income" | "expense" | string;
  date: string; // YYYY-MM-DD
  amount: number | string;
  description?: string | null;
  notes?: string | null;
  category_id?: string | null;
  categories?: { name?: string | null } | null;
  suppliers?: { name?: string | null } | null;
  voided_at?: string | null;
  apartments?: { apartment_number?: number | string | null } | null; // דירת המקור שנרשמה בתנועה
};

export type TxFilters = { q: string; type: "all" | "income" | "expense"; cat: string; year: string; month: string; apt: string };
export const NO_CAT = "none";
export const NO_APT = "none";

export const EMPTY_FILTERS: TxFilters = { q: "", type: "all", cat: "", year: "", month: "", apt: "" };

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(sp: Raw): TxFilters {
  const type = one(sp.type);
  const year = one(sp.year).trim();
  const month = one(sp.month).trim();
  return {
    q: one(sp.q).trim().slice(0, 100),
    type: type === "income" || type === "expense" ? type : "all",
    cat: one(sp.cat).trim(),
    year: /^\d{4}$/.test(year) ? year : "",
    month: /^(?:[1-9]|1[0-2])$/.test(month) ? month : "",
    apt: one(sp.apt).trim().slice(0, 10),
  };
}

export function isFiltered(f: TxFilters): boolean {
  return !!(f.q || f.type !== "all" || f.cat || f.year || f.month || f.apt);
}
export function activeCount(f: TxFilters): number {
  return [f.q, f.type !== "all", f.cat, f.year, f.month, f.apt].filter(Boolean).length;
}

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

// דירות הקשורות לתנועה: דירת המקור שנרשמה בתנועה + שיוכים פעילים. לא מנחש מתוך התיאור.
export function aptsOf(t: TxRow, allocApts: Map<string, Set<string>>): Set<string> {
  const s = new Set<string>(allocApts.get(t.id) ?? []);
  const n = t.apartments?.apartment_number;
  if (n !== null && n !== undefined && String(n) !== "") s.add(String(n));
  return s;
}

export function matches(t: TxRow, f: TxFilters, allocApts: Map<string, Set<string>>): boolean {
  if (f.type !== "all" && t.type !== f.type) return false;
  if (f.cat) {
    if (f.cat === NO_CAT ? !!t.category_id : t.category_id !== f.cat) return false;
  }
  if (f.year && t.date.slice(0, 4) !== f.year) return false;
  if (f.month && Number(t.date.slice(5, 7)) !== Number(f.month)) return false;
  if (f.apt) {
    const a = aptsOf(t, allocApts);
    if (f.apt === NO_APT ? a.size > 0 : !a.has(f.apt)) return false;
  }
  if (f.q) {
    const hay = norm([t.description, t.notes, t.categories?.name, t.suppliers?.name].filter(Boolean).join(" "));
    for (const w of norm(f.q).split(" ")) if (!hay.includes(w)) return false;
  }
  return true;
}

export type TxSummary = { count: number; voided: number; incomeAgorot: number; expenseAgorot: number; netAgorot: number };

export function summarize(rows: TxRow[]): TxSummary {
  let inc = 0, exp = 0, voided = 0;
  for (const t of rows) {
    if (t.voided_at) { voided++; continue; }
    const a = Math.round(Number(t.amount) * 100);
    if (t.type === "income") inc += a; else if (t.type === "expense") exp += a;
  }
  return { count: rows.length, voided, incomeAgorot: inc, expenseAgorot: exp, netAgorot: inc - exp };
}

export function filterTransactions(rows: TxRow[], f: TxFilters, allocApts: Map<string, Set<string>>): TxRow[] {
  return rows.filter((t) => matches(t, f, allocApts));
}
