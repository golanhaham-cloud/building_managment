// שיוך הכנסה קיימת לדירה ולחודשים. פונקציות טהורות (בדיקות ב-tests/allocations.test.ts).
// כל הסכומים מחושבים באגורות שלמות כדי למנוע שגיאות עיגול. האכיפה האמיתית נעשית במסד הנתונים;
// כאן רק תצוגה, בדיקת נוחות לפני שליחה וניסוח הודעות.

export const BASES = ["payer_note", "explicit", "estimated", "unclarified"] as const;
export type Basis = (typeof BASES)[number];

export const BASIS_LABELS: Record<Basis, string> = {
  payer_note: "לפי הערת המשלם",
  explicit: "אושר במפורש",
  estimated: "שיוך משוער",
  unclarified: "טרם הובהר",
};

// "משוער" ו"טרם הובהר" אינם מאושרים. אין שום מצב שבו הם מוצגים כמאושרים.
export const basisIsConfirmed = (b: string | null | undefined) => b === "payer_note" || b === "explicit";
export const basisNeedsNote = (b: string | null | undefined) => b === "estimated" || b === "unclarified";

export const toAg = (n: number | string | null | undefined) => Math.round(Number(n ?? 0) * 100);
export const fromAg = (a: number) => a / 100;

export type AllocRow = {
  key: string;
  kind: "fee" | "special";
  apartment_id: string;
  year: number;
  month: number;
  purpose: string;
  amount: string;
  apartment_basis: Basis | "";
  months_basis: Basis | "";
  basis_note: string;
};

export function rowsTotalAg(rows: Pick<AllocRow, "amount">[]) {
  return rows.reduce((s, r) => s + (Number(r.amount) > 0 ? toAg(r.amount) : 0), 0);
}

// כמה נשאר זמין במקור אחרי השיוכים שבטופס (באגורות). שלילי = חריגה.
export function availableAfterAg(availableAg: number, rows: Pick<AllocRow, "amount">[]) {
  return availableAg - rowsTotalAg(rows);
}

// בדיקת נוחות בצד הלקוח. מחזירה הודעה בעברית או null אם תקין. הבדיקה המחייבת היא במסד.
export function validateRows(rows: AllocRow[], availableAg: number): string | null {
  if (rows.length === 0) return "יש להוסיף לפחות שיוך אחד";
  const seen = new Set<string>();
  for (const r of rows) {
    if (!(Number(r.amount) > 0)) return "יש להזין סכום חיובי בכל שיוך";
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(r.amount.trim())) return "הסכום יכול לכלול עד שתי ספרות אחרי הנקודה";
    if (r.kind === "fee") {
      if (!r.apartment_id) return "יש לבחור דירה בכל שיוך של דמי ועד";
      if (!r.apartment_basis) return "יש לבחור בסיס לזהות הדירה";
      if (!r.months_basis) return "יש לבחור בסיס לחודשי הכיסוי";
      const k = `${r.apartment_id}|${r.year}|${r.month}`;
      if (seen.has(k)) return "אותה דירה ואותו חודש מופיעים פעמיים";
      seen.add(k);
    } else {
      if (r.purpose.trim().length < 2) return "יש להזין את המטרה המיוחדת";
    }
    const needs = basisNeedsNote(r.apartment_basis) || (r.kind === "fee" && basisNeedsNote(r.months_basis));
    if (needs && r.basis_note.trim().length < 3) return "בשיוך משוער או שטרם הובהר יש להזין הערה";
  }
  if (availableAfterAg(availableAg, rows) < 0) return "סכום השיוכים גבוה מהיתרה הזמינה במקור";
  return null;
}

// "נרשם X מתוך Y" ליד חודש. סכום חלקי אינו תשלום מלא.
export function monthProgress(dueNet: number, paid: number): { label: string; state: "full" | "partial" | "none"; remainingAg: number } {
  const d = toAg(dueNet);
  const p = toAg(paid);
  const remainingAg = Math.max(0, d - p);
  if (d > 0 && p >= d) return { label: "שולם במלואו", state: "full", remainingAg: 0 };
  if (p > 0) return { label: "תשלום חלקי", state: "partial", remainingAg };
  return { label: "טרם נרשם", state: "none", remainingAg };
}

// פריט לשליחה לפונקציית ה-DB. הסכום נשלח כמחרוזת כדי לא לאבד דיוק.
export function toRpcItems(rows: AllocRow[]) {
  return rows.map((r) =>
    r.kind === "fee"
      ? {
          kind: "fee",
          apartment_id: r.apartment_id,
          year: r.year,
          month: r.month,
          amount: r.amount.trim(),
          apartment_basis: r.apartment_basis,
          months_basis: r.months_basis,
          basis_note: r.basis_note.trim() || null,
        }
      : { kind: "special", purpose: r.purpose.trim(), amount: r.amount.trim(), basis_note: r.basis_note.trim() || null },
  );
}

// החודש שאחרי (שנה, חודש) – לברירת מחדל של "הוסף חודש".
export function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}
