// הפרדת יתרות הכנסה שטרם שויכו לקבוצות, לתצוגה בלבד (בדיקות ב-tests/income-classes.test.ts).
// לא משנה רישומים: אין יצירה, מחיקה, שיוך או קיזוז. כל יתרה נספרת בקבוצה אחת בלבד.
// הסיווג נשען על סיווג מפורש קיים (קטגוריה, דירת מקור) ועל המקור והתיאור של התנועה. לא על המספר 4 לבדו ולא על הסכום.
export type UnallocatedSource = {
  id: string;
  date: string;
  amount: number | string;
  allocated: number | string;
  available: number | string;
  description: string | null;
  category_name?: string | null; // סיווג מפורש קיים
  apartment_id?: string | null; // דירת מקור שסומנה במפורש
};

export type IncomeGroup = "resident" | "livna4_refund" | "needs_review";

const ag = (n: number | string | null | undefined) => Math.round(Number(n ?? 0) * 100);
const norm = (s: string | null | undefined) => String(s ?? "").replace(/\s+/g, " ").trim();

// המשלם הוא ועד הבית של ליבנה 4: "העברה מאת: ועד בית ליבנה 4 ...". המשלם בראש התיאור, לא כל אזכור של "ליבנה 4".
const PAYER_LIVNA4 = /^(?:העברה מאת:\s*)?ועד\s+(?:ה)?בית\s+ליבנה\s*4(?![\d])/;
// סימנים לתשלום דייר: דירה מפורשת בתיאור, או ביטוי של ועד הבית כתשלום דמי ועד ("... עד הבית", "דמי ועד").
const RESIDENT_HINT = /דירה\s*\d+|(?:^|\s)ו?עד\s+הבית(?:\s|$)|דמי\s+ועד/;
const RESIDENT_CATEGORY = "ועד בית";

export function classifySource(s: UnallocatedSource): { group: IncomeGroup; reason: string } {
  const d = norm(s.description);
  const refund = PAYER_LIVNA4.test(d);
  const explicitResident = !!s.apartment_id || norm(s.category_name) === RESIDENT_CATEGORY;
  if (refund && explicitResident) return { group: "needs_review", reason: "המשלם הוא ועד ליבנה 4, אך הסיווג המפורש בתנועה הוא של תשלום דייר" };
  if (refund) return { group: "livna4_refund", reason: "המשלם הוא ועד בית ליבנה 4" };
  if (explicitResident) return { group: "resident", reason: s.apartment_id ? "סומנה דירת מקור" : `קטגוריה מפורשת: ${RESIDENT_CATEGORY}` };
  if (RESIDENT_HINT.test(d)) return { group: "resident", reason: "התיאור מציין דירה או דמי ועד" };
  return { group: "needs_review", reason: "אין סיווג מפורש ואין מקור או תיאור שמזהים בביטחון" };
}

export type GroupedItem = UnallocatedSource & { availableAg: number; reason: string };
export type Grouped = Record<IncomeGroup, { items: GroupedItem[]; totalAg: number }>;

// מקבץ רק מקורות עם יתרה שלא שויכה (available > 0). שיוך חלקי: רק היתרה נספרת. ממוין מהחדש לישן.
export function groupUnallocated(sources: UnallocatedSource[]): Grouped {
  const out: Grouped = { resident: { items: [], totalAg: 0 }, livna4_refund: { items: [], totalAg: 0 }, needs_review: { items: [], totalAg: 0 } };
  for (const s of sources) {
    const availableAg = ag(s.available);
    if (availableAg <= 0) continue;
    const { group, reason } = classifySource(s);
    out[group].items.push({ ...s, availableAg, reason });
    out[group].totalAg += availableAg;
  }
  for (const g of Object.values(out)) g.items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

// החזר מליבנה 4 הוא הכנסה של הבניין, לא תשלום דייר: אי אפשר לשייך אותו לדירה ולחודשים.
// אותו כלל בכל המסכים ובצד השרת, על אותו סיווג משותף (classifySource). needs_review אינו נחסם:
// אין מספיק נתונים כדי להבחין, והפער מוצג בעמוד הגבייה בלי ניחוש.
export const LIVNA4_REFUND_NOTE = "החזר מליבנה 4 - הכנסה של הבניין, לא תשלום דייר";
export const LIVNA4_REFUND_BLOCK = "החזר מליבנה 4 הוא הכנסה של הבניין ולא תשלום דייר, ולכן לא ניתן לשייך אותו לדירה ולחודשים";

export function isLivna4Refund(s: UnallocatedSource): boolean {
  return classifySource(s).group === "livna4_refund";
}

// הפרדת מקורות לשיוך: דיירים וממתיני סיווג נשארים זמינים, החזרי ליבנה 4 יוצאים מהבחירה.
export function partitionAllocatable<T extends UnallocatedSource>(sources: T[]): { allocatable: T[]; refunds: T[] } {
  const allocatable: T[] = [];
  const refunds: T[] = [];
  for (const s of sources) (isLivna4Refund(s) ? refunds : allocatable).push(s);
  return { allocatable, refunds };
}

// אכיפת צד שרת לפני כל פעולת שיוך. זורק שגיאה בעברית על החזר; לא משנה דבר במקורות תקינים,
// כולל תשלום של דירה 4 בבניין ותשלום חלקי.
export function assertAllocatable(meta: { description: string | null; category_name?: string | null; apartment_id?: string | null }): void {
  if (isLivna4Refund({ id: "", date: "", amount: 0, allocated: 0, available: 0, ...meta })) {
    throw new Error(`LIVNA4_REFUND: ${LIVNA4_REFUND_BLOCK}`);
  }
}
