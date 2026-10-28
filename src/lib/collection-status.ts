// מצב גבייה וחובות: חישוב טהור (בדיקות ב-tests/collection-status.test.ts). הכול באגורות שלמות.
// הנתונים מגיעים מ-collection_status() במסד (אותם חיובים, התאמות, תשלומים ושיוכים שמזינים את מסך התשלומים החודשי).
// עיקרון: פער בין חיוב לתשלום אינו חוב מאומת. החלטות הוועד (הפחתה / חוב מאומת) מקטינות את הפער הפתוח,
// והיתרה נשארת "לבירור". הפחתה אינה תשלום ואינה יוצרת הכנסה.

export type StatusRow = {
  apartment_id: string;
  year: number | string;
  month: number | string;
  base_due: number | string | null;
  adjustments_total: number | string | null;
  credits_total: number | string | null;
  extras_total: number | string | null;
  paid_total: number | string | null;
  direct_paid: number | string | null;
  allocated_paid: number | string | null;
  reduction_amount: number | string | null;
  reduction_id: string | null;
  verified_amount: number | string | null;
  verified_id: string | null;
};

export const toAg = (n: number | string | null | undefined) => Math.round(Number(n ?? 0) * 100);
export const fromAg = (a: number) => a / 100;

export type MonthStatus = {
  key: string; // apartment|year|month
  apartment_id: string;
  year: number;
  month: number;
  baseAg: number;
  adjAg: number; // סך התאמות (זיכויים שליליים + חיובים נוספים)
  creditsAg: number; // שלילי
  extrasAg: number;
  netAg: number; // חיוב לחודש = בסיס + התאמות
  paidAg: number; // מוכר: ישיר + משויך
  directAg: number;
  allocatedAg: number;
  shortfallAg: number; // פער פתוח = max(0, חיוב − שולם)
  reductionAg: number; // הפחתה שאושרה (מופעלת, מוגבלת לפער)
  verifiedAg: number; // חוב מאומת (מוגבל לפער שנותר אחרי הפחתה)
  clarifyAg: number; // לבירור = פער − הפחתה − חוב מאומת
  surplusAg: number; // תשלום מעל החיוב, אינו מקוזז בין חודשים
  excessDecisionAg: number; // סכום החלטות שסותר את המצב (לסימון בלבד, אינו נספר). אינו כולל החלטות שנסגרו בתשלום.
  grossAg: number; // חיוב לפני זיכויים = בסיס + חיובים נוספים (מה שהתשלום צריך לכסות)
  closedByPayment: boolean; // הפער נסגר בתשלומים תקפים בלבד (לא בזיכוי, הפחתה או ביטול חיוב)
  closedVerifiedAg: number; // החלטת חוב מאומת היסטורית שנסגרה בתשלום (אינה חוב פתוח)
  closedReductionAg: number; // החלטת הפחתה היסטורית שנסגרה בתשלום
  reductionId: string | null;
  verifiedId: string | null;
};

export function monthStatus(r: StatusRow): MonthStatus {
  const year = Number(r.year);
  const month = Number(r.month);
  const baseAg = toAg(r.base_due);
  const adjAg = toAg(r.adjustments_total);
  const netAg = baseAg + adjAg;
  const paidAg = toAg(r.paid_total);
  const shortfallAg = Math.max(0, netAg - paidAg);
  const surplusAg = Math.max(0, paidAg - netAg);
  const redIn = toAg(r.reduction_amount);
  const verIn = toAg(r.verified_amount);
  // סדר החלה קבוע: קודם הפחתה, אחריה חוב מאומת, כל אחד מוגבל ליתרת הפער. כך הסכום אינו נספר פעמיים.
  const reductionAg = Math.min(redIn, shortfallAg);
  const verifiedAg = Math.min(verIn, shortfallAg - reductionAg);
  const clarifyAg = shortfallAg - reductionAg - verifiedAg;
  // החלטה היסטורית מול חוב פתוח: כשהחיוב (לפני זיכויים) כוסה במלואו בתשלומים תקפים, החלטת החוב נסגרה בתשלום.
  // פער אפס בלבד אינו מספיק: אם הוא נוצר בגלל זיכוי, הפחתה או שינוי חיוב, ההחלטה נשארת סותרת ומסומנת.
  // החישוב מבוסס על המצב הנוכחי, ולכן ביטול תשלום מחזיר את ההחלטה להיות חוב פתוח.
  const grossAg = baseAg + toAg(r.extras_total);
  const closedByPayment = shortfallAg === 0 && grossAg > 0 && paidAg >= grossAg && redIn + verIn > 0;
  const closedVerifiedAg = closedByPayment ? Math.min(verIn, grossAg) : 0;
  const closedReductionAg = closedByPayment ? Math.min(redIn, grossAg - closedVerifiedAg) : 0;
  return {
    key: `${r.apartment_id}|${year}|${month}`,
    apartment_id: r.apartment_id,
    year,
    month,
    baseAg,
    adjAg,
    creditsAg: toAg(r.credits_total),
    extrasAg: toAg(r.extras_total),
    netAg,
    paidAg,
    directAg: toAg(r.direct_paid),
    allocatedAg: toAg(r.allocated_paid),
    shortfallAg,
    reductionAg,
    verifiedAg,
    clarifyAg,
    surplusAg,
    excessDecisionAg: redIn + verIn - reductionAg - verifiedAg - closedVerifiedAg - closedReductionAg,
    grossAg,
    closedByPayment,
    closedVerifiedAg,
    closedReductionAg,
    reductionId: r.reduction_id,
    verifiedId: r.verified_id,
  };
}

export type Totals = {
  chargesAg: number;
  paidAg: number;
  reductionAg: number;
  verifiedAg: number;
  clarifyAg: number;
  surplusAg: number;
  excessAg: number;
  closedVerifiedAg: number;
  closedReductionAg: number;
  closedMonths: number; // חודשים עם החלטה היסטורית שנסגרה בתשלום
  months: number;
  gapMonths: number;
};

const empty = (): Totals => ({ chargesAg: 0, paidAg: 0, reductionAg: 0, verifiedAg: 0, clarifyAg: 0, surplusAg: 0, excessAg: 0, closedVerifiedAg: 0, closedReductionAg: 0, closedMonths: 0, months: 0, gapMonths: 0 });

// סיכום נגזר תמיד מאותן שורות חודשיות שמוצגות בפירוט, כך שסיכום ופירוט אינם יכולים להיפרד.
export function sumMonths(list: MonthStatus[]): Totals {
  const t = empty();
  for (const m of list) {
    t.chargesAg += m.netAg;
    t.paidAg += m.paidAg;
    t.reductionAg += m.reductionAg;
    t.verifiedAg += m.verifiedAg;
    t.clarifyAg += m.clarifyAg;
    t.surplusAg += m.surplusAg;
    t.excessAg += m.excessDecisionAg;
    t.closedVerifiedAg += m.closedVerifiedAg;
    t.closedReductionAg += m.closedReductionAg;
    if (m.closedVerifiedAg + m.closedReductionAg > 0) t.closedMonths += 1;
    t.months += 1;
    if (m.shortfallAg > 0) t.gapMonths += 1;
  }
  return t;
}

export type YM = { year: number; month: number };
export const ymIndex = (y: number, m: number) => y * 12 + (m - 1);
export const ymKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

export function parseYm(s: string | undefined | null): YM | null {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 1 && month <= 12 && year >= 2020 && year <= 2100 ? { year, month } : null;
}

// טווח החודשים נגזר מהנתונים הקיימים (לא מקודד). מחזיר null כשאין חיובים.
export function monthRange(rows: Pick<StatusRow, "year" | "month">[]): { from: YM; to: YM } | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rows) {
    const i = ymIndex(Number(r.year), Number(r.month));
    if (i < lo) lo = i;
    if (i > hi) hi = i;
  }
  if (!isFinite(lo)) return null;
  const f = (i: number): YM => ({ year: Math.floor(i / 12), month: (i % 12) + 1 });
  return { from: f(lo), to: f(hi) };
}

// תקופה מבוקשת, מוגבלת לטווח הנתונים; ערך לא תקין או הפוך חוזר לטווח המלא.
export function resolvePeriod(range: { from: YM; to: YM }, from?: string, to?: string): { from: YM; to: YM } {
  const lo = ymIndex(range.from.year, range.from.month);
  const hi = ymIndex(range.to.year, range.to.month);
  const pf = parseYm(from);
  const pt = parseYm(to);
  let a = pf ? ymIndex(pf.year, pf.month) : lo;
  let b = pt ? ymIndex(pt.year, pt.month) : hi;
  a = Math.min(Math.max(a, lo), hi);
  b = Math.min(Math.max(b, lo), hi);
  if (a > b) [a, b] = [b, a];
  const f = (i: number): YM => ({ year: Math.floor(i / 12), month: (i % 12) + 1 });
  return { from: f(a), to: f(b) };
}

export type AptGroup = { apartment_id: string; months: MonthStatus[]; totals: Totals };

// קיבוץ לפי דירה (אותן שורות חודשיות). months ממוין מהחדש לישן.
export function groupByApartment(rows: StatusRow[], period: { from: YM; to: YM }, apartmentId?: string | null): AptGroup[] {
  const lo = ymIndex(period.from.year, period.from.month);
  const hi = ymIndex(period.to.year, period.to.month);
  const by = new Map<string, MonthStatus[]>();
  for (const r of rows) {
    if (apartmentId && r.apartment_id !== apartmentId) continue;
    const i = ymIndex(Number(r.year), Number(r.month));
    if (i < lo || i > hi) continue;
    const ms = monthStatus(r);
    (by.get(ms.apartment_id) ?? by.set(ms.apartment_id, []).get(ms.apartment_id)!).push(ms);
  }
  return Array.from(by, ([apartment_id, months]) => {
    months.sort((a, b) => ymIndex(b.year, b.month) - ymIndex(a.year, a.month));
    return { apartment_id, months, totals: sumMonths(months) };
  });
}

export const overallTotals = (groups: AptGroup[]) => sumMonths(groups.flatMap((g) => g.months));

// הפחתה שמותרת להוסיף/לעדכן: הפער הפתוח פחות החלטה מהסוג השני. הבדיקה המחייבת היא במסד.
export function decisionRoom(m: MonthStatus, kind: "reduction" | "verified_debt"): number {
  const other = kind === "reduction" ? m.verifiedAg : m.reductionAg;
  return Math.max(0, m.shortfallAg - other);
}

export const hasGap = (m: MonthStatus) => m.shortfallAg > 0;

// חודש שיש בו החלטת ועד שאינה חוב פתוח אך חשוב להישאר גלוי בהיסטוריה / בהתראות (גם כשמסנן "רק חודשים עם פער" פעיל).
export const hasVisibleDecisionState = (m: MonthStatus) => m.excessDecisionAg > 0 || m.closedVerifiedAg > 0 || m.closedReductionAg > 0;

export type ExcessItem = { apartment_id: string; year: number; month: number; key: string; excessAg: number; reason: "exceeds_gap" | "gap_closed_otherwise" };

// התראות על סתירות אמיתיות בלבד: החלטה שחורגת מהפער הפתוח, או החלטה בחודש שהפער בו אפס שלא בגלל תשלום.
// החלטה שנסגרה בתשלום אינה כאן. כל פריט מצביע על החודש שיצר אותו (לקישור בתצוגה).
export function excessItems(groups: AptGroup[]): ExcessItem[] {
  const out: ExcessItem[] = [];
  for (const g of groups)
    for (const m of g.months)
      if (m.excessDecisionAg > 0)
        out.push({ apartment_id: m.apartment_id, year: m.year, month: m.month, key: m.key, excessAg: m.excessDecisionAg, reason: m.shortfallAg === 0 ? "gap_closed_otherwise" : "exceeds_gap" });
  return out;
}

// ניסוח כיסוי הבנק. תאריך הכיסוי אינו נגזר מתנועה ידנית, ומועד הייבוא נפרד ממנו.
export function coverageSummary(c: { covered_until: string | null; last_import_at: string | null; after_count: number; after_last_date: string | null } | null) {
  if (!c || !c.covered_until) return { known: false as const, text: "לא תועד כיסוי של ייבוא מהבנק" };
  return {
    known: true as const,
    text: `תנועות הבנק מכוסות עד ${c.covered_until}`,
    manualAfter: c.after_count > 0 ? (c.after_count === 1 ? `רשומה ידנית אחת אחרי תאריך זה (${c.after_last_date})` : `${c.after_count} רשומות ידניות אחרי תאריך זה (האחרונה: ${c.after_last_date})`) : null,
  };
}
