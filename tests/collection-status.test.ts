import assert from "node:assert/strict";
import { monthStatus, sumMonths, groupByApartment, overallTotals, monthRange, resolvePeriod, decisionRoom, coverageSummary, excessItems, hasVisibleDecisionState, toAg, type StatusRow } from "../src/lib/collection-status";

const row = (o: Partial<StatusRow> & { apartment_id?: string; year?: number; month?: number }): StatusRow => ({
  apartment_id: "a1", year: 2026, month: 10, base_due: 290, adjustments_total: 0, credits_total: 0, extras_total: 0,
  paid_total: 0, direct_paid: 0, allocated_paid: 0, reduction_amount: 0, reduction_id: null, verified_amount: 0, verified_id: null, ...o,
});

// 1. ברירת מחדל: פער הוא "לבירור", לא חוב מאומת
let m = monthStatus(row({ base_due: 225, paid_total: 185 }));
assert.equal(m.shortfallAg, 4000); assert.equal(m.clarifyAg, 4000); assert.equal(m.verifiedAg, 0); assert.equal(m.reductionAg, 0);

// 2. הפחתה אינה תשלום: paid לא משתנה, הפער לבירור קטן
m = monthStatus(row({ base_due: 225, paid_total: 185, reduction_amount: 40 }));
assert.equal(m.paidAg, 18500); assert.equal(m.reductionAg, 4000); assert.equal(m.clarifyAg, 0);

// 3. כמה סוגי פער בחודש אחד מוצגים בנפרד וסכומם הוא הפער
m = monthStatus(row({ base_due: 330, paid_total: 230, reduction_amount: 30, verified_amount: 50 }));
assert.deepEqual([m.reductionAg, m.verifiedAg, m.clarifyAg], [3000, 5000, 2000]);
assert.equal(m.reductionAg + m.verifiedAg + m.clarifyAg, m.shortfallAg);

// 4. החלטות מעל הפער לא נספרות פעמיים (הפחתה קודמת לחוב), והעודף מסומן
m = monthStatus(row({ base_due: 100, paid_total: 60, reduction_amount: 30, verified_amount: 30 }));
assert.deepEqual([m.reductionAg, m.verifiedAg, m.clarifyAg, m.excessDecisionAg], [3000, 1000, 0, 2000]);

// 5. התאמות נכללות בחיוב; זיכוי מקטין
m = monthStatus(row({ base_due: 290, adjustments_total: 40, extras_total: 40, paid_total: 290 }));
assert.equal(m.netAg, 33000); assert.equal(m.shortfallAg, 4000);
m = monthStatus(row({ base_due: 290, adjustments_total: -40, credits_total: -40, paid_total: 250 }));
assert.equal(m.netAg, 25000); assert.equal(m.shortfallAg, 0);

// 6. עודף תשלום מוצג בנפרד ואינו מקוזז מחודש אחר
const rows: StatusRow[] = [
  row({ month: 8, base_due: 290, paid_total: 340 }),
  row({ month: 9, base_due: 290, paid_total: 250 }),
];
const g = groupByApartment(rows, { from: { year: 2026, month: 8 }, to: { year: 2026, month: 9 } });
assert.equal(g[0].totals.surplusAg, 5000); assert.equal(g[0].totals.clarifyAg, 4000);

// 7. סיכום = סכום הפירוט, ומתקיים: חיוב − שולם + עודף = הפחתה + חוב מאומת + לבירור
const many: StatusRow[] = [];
for (let a = 1; a <= 4; a++) for (let mo = 1; mo <= 12; mo++)
  many.push(row({ apartment_id: `a${a}`, month: mo, base_due: 225 + a * 5, adjustments_total: mo % 3 === 0 ? -20 : 0, paid_total: (a * mo * 7) % 300, reduction_amount: mo % 5 === 0 ? 15 : 0, verified_amount: mo % 7 === 0 ? 10 : 0 }));
const period = { from: { year: 2026, month: 1 }, to: { year: 2026, month: 12 } };
const groups = groupByApartment(many, period);
const all = overallTotals(groups);
assert.equal(all.chargesAg, groups.reduce((s, x) => s + x.totals.chargesAg, 0));
assert.equal(all.clarifyAg, groups.reduce((s, x) => s + x.totals.clarifyAg, 0));
assert.equal(all.chargesAg - all.paidAg + all.surplusAg, all.reductionAg + all.verifiedAg + all.clarifyAg);
for (const x of groups) assert.equal(x.totals.chargesAg - x.totals.paidAg + x.totals.surplusAg, x.totals.reductionAg + x.totals.verifiedAg + x.totals.clarifyAg);
assert.equal(sumMonths(groups.flatMap((x) => x.months)).months, 48);

// 8. סינון תקופה ודירה משפיע גם על הסיכום וגם על הפירוט
const sub = groupByApartment(many, { from: { year: 2026, month: 3 }, to: { year: 2026, month: 5 } }, "a2");
assert.equal(sub.length, 1); assert.equal(sub[0].months.length, 3); assert.equal(sub[0].totals.months, 3);
assert.deepEqual(sub[0].months.map((x) => x.month), [5, 4, 3]);

// 9. טווח נגזר מהנתונים ותקופה לא תקינה נחתכת לטווח
const rg = monthRange([{ year: 2024, month: 12 }, { year: 2026, month: 10 }, { year: 2025, month: 3 }])!;
assert.deepEqual(rg, { from: { year: 2024, month: 12 }, to: { year: 2026, month: 10 } });
assert.deepEqual(resolvePeriod(rg, "2023-01", "2030-01"), rg);
assert.deepEqual(resolvePeriod(rg, "2026-05", "2025-02"), { from: { year: 2025, month: 2 }, to: { year: 2026, month: 5 } });
assert.deepEqual(resolvePeriod(rg, "garbage", undefined), rg);
assert.equal(monthRange([]), null);

// 10. מקום להחלטה = פער פחות ההחלטה מהסוג השני
m = monthStatus(row({ base_due: 100, paid_total: 0, reduction_amount: 30 }));
assert.equal(decisionRoom(m, "verified_debt"), 7000); assert.equal(decisionRoom(m, "reduction"), 10000);

// 11. כיסוי בנק נפרד מרשומות ידניות
const c = coverageSummary({ covered_until: "2026-10-16", last_import_at: "2026-10-25T14:37:55Z", after_count: 1, after_last_date: "2026-10-26" });
assert.ok(c.known && c.text.includes("2026-10-16") && c.manualAfter!.includes("2026-10-26"));
assert.equal(coverageSummary(null).known, false);

// 12. דירה 6: הפחתות 40 ו-100 מקטינות את הלבירור בלי לשנות את התשלום
const a6 = [monthStatus(row({ apartment_id: "a6", year: 2025, month: 7, base_due: 225, paid_total: 185, reduction_amount: 40 })), monthStatus(row({ apartment_id: "a6", year: 2026, month: 8, base_due: 225, paid_total: 125, reduction_amount: 100 }))];
const t6 = sumMonths(a6);
assert.deepEqual([t6.reductionAg, t6.clarifyAg, t6.paidAg, t6.verifiedAg], [14000, 0, 31000, 0]);
console.log("collection-status tests passed");

// ===== החלטה היסטורית מול חוב פתוח (תיקון סטטוס, תצוגה בלבד) =====
// A. מקרה דירה 13: אוגוסט 290, ספטמבר 290, אוקטובר 330 (290 + חיוב נוסף 40); תשלום 910 שויך במלואו; החלטות חוב מאומת על אותם סכומים.
const a13 = [
  row({ apartment_id: "a13", month: 8, base_due: 290, paid_total: 290, allocated_paid: 290, verified_amount: 290, verified_id: "v8" }),
  row({ apartment_id: "a13", month: 9, base_due: 290, paid_total: 290, allocated_paid: 290, verified_amount: 290, verified_id: "v9" }),
  row({ apartment_id: "a13", month: 10, base_due: 290, adjustments_total: 40, extras_total: 40, paid_total: 330, allocated_paid: 330, verified_amount: 330, verified_id: "v10" }),
];
// שאר הבניין: חובות מאומתים פתוחים בסך 14,015 ₪ (דירות אחרות)
const others = [
  row({ apartment_id: "a1", month: 8, base_due: 20000, paid_total: 0, verified_amount: 8015, verified_id: "o1" }),
  row({ apartment_id: "a2", month: 9, base_due: 20000, paid_total: 0, verified_amount: 6000, verified_id: "o2" }),
];
const p3 = { from: { year: 2026, month: 8 }, to: { year: 2026, month: 10 } };
let gr = groupByApartment([...a13, ...others], p3);
const g13 = gr.find((x) => x.apartment_id === "a13")!;
assert.deepEqual(g13.months.map((x) => [x.shortfallAg, x.verifiedAg, x.clarifyAg, x.excessDecisionAg, x.closedByPayment, x.closedVerifiedAg]),
  [[0, 0, 0, 0, true, 33000], [0, 0, 0, 0, true, 29000], [0, 0, 0, 0, true, 29000]]);
assert.equal(g13.totals.verifiedAg, 0); assert.equal(g13.totals.clarifyAg, 0); assert.equal(g13.totals.excessAg, 0);
assert.equal(g13.totals.closedVerifiedAg, 91000); assert.equal(g13.totals.closedMonths, 3);
assert.equal(overallTotals(gr).verifiedAg, 1401500, "סך החוב המאומת בבניין נשאר 14,015");
assert.equal(overallTotals(gr).excessAg, 0); assert.deepEqual(excessItems(gr), []);
assert.ok(g13.months.every(hasVisibleDecisionState), "החלטה שנסגרה בתשלום נשארת גלויה בהיסטוריה");

// B. תשלום חלקי אחרי החלטה: הפער הפתוח נשאר חוב, והסכום החורג מסומן עם קישור לחודש
m = monthStatus(row({ base_due: 290, paid_total: 150, verified_amount: 290 }));
assert.deepEqual([m.shortfallAg, m.verifiedAg, m.excessDecisionAg, m.closedByPayment, m.closedVerifiedAg], [14000, 14000, 15000, false, 0]);
const exB = excessItems(groupByApartment([row({ base_due: 290, paid_total: 150, verified_amount: 290 })], p3));
assert.equal(exB.length, 1); assert.equal(exB[0].reason, "exceeds_gap"); assert.equal(exB[0].excessAg, 15000); assert.equal(exB[0].month, 10);

// C. חודש שלא שולם: החלטה היא חוב פתוח מלא, ללא התראה
m = monthStatus(row({ base_due: 290, paid_total: 0, verified_amount: 290 }));
assert.deepEqual([m.verifiedAg, m.clarifyAg, m.excessDecisionAg, m.closedVerifiedAg], [29000, 0, 0, 0]);

// D. החלטה שסכומה חורג מהפער: החלק החורג מסומן, והחוב הפתוח מוגבל לפער
m = monthStatus(row({ base_due: 290, paid_total: 250, verified_amount: 100 }));
assert.deepEqual([m.shortfallAg, m.verifiedAg, m.excessDecisionAg, m.closedByPayment], [4000, 4000, 6000, false]);
// החלטה גדולה מהחיוב עצמו גם כשהחיוב שולם במלואו: רק החלק עד החיוב נסגר, היתר נשאר התראה
m = monthStatus(row({ base_due: 290, paid_total: 290, verified_amount: 500 }));
assert.deepEqual([m.closedVerifiedAg, m.excessDecisionAg, m.verifiedAg], [29000, 21000, 0]);

// E. סגירת פער באמצעות הפחתה (לא תשלום): נשארת הפחתה, לא "נסגר בתשלום", ללא התראה
m = monthStatus(row({ base_due: 290, paid_total: 250, reduction_amount: 40 }));
assert.deepEqual([m.shortfallAg, m.reductionAg, m.clarifyAg, m.closedByPayment, m.closedReductionAg, m.excessDecisionAg], [4000, 4000, 0, false, 0, 0]);
// פער אפס בגלל זיכוי / ביטול חיוב (לא תשלום): החלטת חוב סותרת, אינה "נסגרה בתשלום"
m = monthStatus(row({ base_due: 290, adjustments_total: -40, credits_total: -40, paid_total: 250, verified_amount: 40 }));
assert.deepEqual([m.shortfallAg, m.closedByPayment, m.closedVerifiedAg, m.verifiedAg, m.excessDecisionAg], [0, false, 0, 0, 4000]);
let exE = excessItems(groupByApartment([row({ base_due: 290, adjustments_total: -40, credits_total: -40, paid_total: 250, verified_amount: 40 })], p3));
assert.equal(exE.length, 1); assert.equal(exE[0].reason, "gap_closed_otherwise");
m = monthStatus(row({ base_due: 0, paid_total: 0, verified_amount: 290 })); // חיוב בוטל (אפס): לא נסגר בתשלום
assert.deepEqual([m.closedByPayment, m.closedVerifiedAg, m.excessDecisionAg], [false, 0, 29000]);

// F. ביטול תשלום אחרי סגירת החוב: החוב חוזר להיות פתוח, ההחלטה נשמרת (אותו סכום קלט), הכספים לא משתנים
const closedRow = row({ base_due: 290, paid_total: 290, allocated_paid: 290, verified_amount: 290, verified_id: "vx" });
const frozen = JSON.stringify(closedRow);
const before = monthStatus(closedRow);
assert.deepEqual([before.closedByPayment, before.verifiedAg], [true, 0]);
const reopened = monthStatus({ ...closedRow, paid_total: 0, allocated_paid: 0 });
assert.deepEqual([reopened.closedByPayment, reopened.verifiedAg, reopened.shortfallAg, reopened.excessDecisionAg, reopened.verifiedId], [false, 29000, 29000, 0, "vx"]);
assert.equal(JSON.stringify(closedRow), frozen, "הקלט (ההחלטה ההיסטורית) לא משתנה");
// תשלום חלקי אחרי ביטול חלקי של התשלום: חלק נשאר חוב פתוח
const partialAgain = monthStatus({ ...closedRow, paid_total: 100 });
assert.deepEqual([partialAgain.verifiedAg, partialAgain.excessDecisionAg, partialAgain.closedByPayment], [19000, 10000, false]);

// G. הסכומים הכספיים אינם תלויים בתיקון: מול הנוסחה הישנה, הפחתה/חוב מאומת/לבירור/פער/עודף זהים, והחריגה רק קטנה
for (const r of many) {
  const s = monthStatus(r);
  const net = toAg(r.base_due) + toAg(r.adjustments_total), paid = toAg(r.paid_total), gap = Math.max(0, net - paid);
  const red = Math.min(toAg(r.reduction_amount), gap), ver = Math.min(toAg(r.verified_amount), gap - red);
  assert.deepEqual([s.shortfallAg, s.reductionAg, s.verifiedAg, s.clarifyAg, s.surplusAg, s.netAg, s.paidAg], [gap, red, ver, gap - red - ver, Math.max(0, paid - net), net, paid]);
  const oldExcess = toAg(r.reduction_amount) + toAg(r.verified_amount) - red - ver;
  assert.ok(s.excessDecisionAg <= oldExcess && s.excessDecisionAg + s.closedVerifiedAg + s.closedReductionAg === oldExcess);
}
console.log("ok   decision history vs open debt");
