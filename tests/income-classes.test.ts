import assert from "node:assert/strict";
import { classifySource, groupUnallocated, groupsTotalAg, type UnallocatedSource } from "../src/lib/income-classes";

let n = 0;
const S = (description: string, amount: number, over: Partial<UnallocatedSource> = {}): UnallocatedSource => ({ id: `t${++n}`, date: "2026-01-01", amount, allocated: 0, available: amount, description, ...over });

// זיהוי החזרי ליבנה 4 לפי המשלם (כולל ניסוחים שונים, בלי להסתמך על הסכום)
for (const d of [
  "העברה מאת: ועד בית ליבנה 4 חשמל משותף ליבנה 4+6", "העברה מאת: ועד בית ליבנה 4", "העברה מאת: ועד בית ליבנה 4 חדמל משותף ליבנה 4+6",
  "העברה מאת: ועד בית ליבנה 4 חודשי משאבות +מועדון ליבנה 6+4", "העברה מאת:  ועד  בית  ליבנה  4  תשלום משאבות",
]) assert.equal(classifySource(S(d, 123.45)).group, "livna4_refund", d);

// תשלומי דיירים
assert.equal(classifySource(S("העברה מאת: סבח רונן עד הבית", 225)).group, "resident");
assert.equal(classifySource(S("העברה מאת: בליטי רז משפחת אוחיון דירה 11", 1700, { category_name: "ועד בית" })).group, "resident");
assert.equal(classifySource(S("העברה מאת: כהן דמי ועד", 300)).group, "resident");
assert.equal(classifySource(S("העברה", 300, { apartment_id: "apt" })).group, "resident");

// לא מסתמכים על המספר 4 לבדו או על הסכום
assert.equal(classifySource(S("העברה מאת: כהן דירה 4", 225)).group, "resident");
assert.equal(classifySource(S("העברה מאת: לוי חשמל ליבנה 4", 8168.45)).group, "needs_review");
assert.equal(classifySource(S("העברה מאת: ועד בית ליבנה 40", 100)).group, "needs_review");
assert.equal(classifySource(S("העברה מאת: משה 4", 435)).group, "needs_review");
// "ליבנה 4" שלא בתפקיד המשלם אינו מסווג כהחזר
assert.equal(classifySource(S("העברה מאת: דירה 9 שותפות ועד בית ליבנה 4", 200)).group, "resident");
// סתירה בין משלם לסיווג מפורש -> בירור
assert.equal(classifySource(S("העברה מאת: ועד בית ליבנה 4 חשמל", 100, { category_name: "ועד בית" })).group, "needs_review");
// תיאור ריק או לא מזוהה -> בירור, לא נעלם
assert.equal(classifySource(S("", 50)).group, "needs_review");
assert.equal(classifySource({ ...S("x", 1), description: null }).group, "needs_review");

// קיבוץ: שיוך חלקי מציג רק יתרה, מלא לא מופיע, כל יתרה בקבוצה אחת, סכומים נגזרים
const list: UnallocatedSource[] = [
  S("העברה מאת: בליטי רז משפחת אוחיון דירה 11", 1700, { allocated: 1490, available: 210, category_name: "ועד בית", date: "2026-10-14" }),
  S("העברה מאת: סבח רונן עד הבית", 225, { date: "2024-12-25" }),
  S("העברה מאת: ועד בית ליבנה 4 חשמל", 1500, { date: "2025-03-11" }),
  S("העברה מאת: ועד בית ליבנה 4", 141.46, { date: "2025-04-14" }),
  S("העברה מאת: ועד בית ליבנה 4 חשמל", 500, { allocated: 500, available: 0 }),
  S("העברה מוזרה", 77.7),
];
const g = groupUnallocated(list);
assert.equal(g.resident.totalAg, 43500);
assert.equal(g.livna4_refund.totalAg, 164146);
assert.equal(g.needs_review.totalAg, 7770);
assert.deepEqual(g.resident.items.map((i) => i.availableAg), [21000, 22500]); // ממוין מהחדש לישן, יתרה בלבד
assert.equal(groupsTotalAg(g), list.reduce((s, x) => s + Math.round(Number(x.available) * 100), 0));
const ids = Object.values(g).flatMap((x) => x.items.map((i) => i.id));
assert.equal(new Set(ids).size, ids.length); // בלי כפילות
assert.equal(ids.length, 5); // המקור ששויך במלואו אינו מופיע
console.log("income-classes tests passed");
