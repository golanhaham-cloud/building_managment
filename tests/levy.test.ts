import { apartmentFromNote, levyState, summarizeLevy, LEVY_TARGET_AG, LEVY_PURPOSE, LEVY_PURPOSE_LEGACY, type LevyAlloc } from "../src/lib/levy";

let fails = 0;
function ok(n: string, c: boolean) { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; }

// זיהוי דירה מהערה: רק "דירה N" מפורש
ok("no note -> no apartment", apartmentFromNote(null) === null && apartmentFromNote("") === null);
ok("plain 'דירה 9' is found", apartmentFromNote("אושר ע\"י גולן: דירה 9 (גיא שמילוביץ)") === "9");
ok("first 'דירה N' wins, amounts and totals are not apartments", apartmentFromNote("דירה 9 - חלק ראשון (251) מתוך 500 ₪; נותרו 249") === "9");
ok("other numbers without the word are not an apartment", apartmentFromNote("חלק ראשון 251 מתוך 500") === null);
ok("three-digit number is not an apartment", apartmentFromNote("דירה 100") === null);

// סטטוס: גבולות 500 ש"ח
ok("zero is 'no record'", levyState(0) === "none");
ok("one agora is partial", levyState(1) === "partial");
ok("499.99 is partial", levyState(LEVY_TARGET_AG - 1) === "partial");
ok("500 exactly is full", levyState(LEVY_TARGET_AG) === "full");
ok("over 500 is still full", levyState(LEVY_TARGET_AG + 10000) === "full");

// צבירה: מובנה גובר על הערה; חסר דירה נספר בסך הכל ומוצג בנפרד
const apts = Array.from({ length: 19 }, (_, i) => ({ id: `a${i + 1}`, number: String(i + 1) }));
const al = (o: Partial<LevyAlloc>): LevyAlloc => ({ id: Math.random().toString(36).slice(2), amount: 500, apartment_id: null, purpose: "שיפור הבניין", basis_note: null, date: "2026-10-01", created_at: null, ...o });
const s = summarizeLevy(apts, [
  al({ apartment_id: "a9", basis_note: "דירה 15 בהערה אבל מובנה גובר" }),   // דירה 9 מובנית
  al({ amount: 251, basis_note: "אושר: דירה 9 - חלק ראשון" }),             // דירה 9 דרך הערה
  al({ basis_note: "אושר: דירה 4" }),                                       // דירה 4 דרך הערה
  al({ amount: 100, basis_note: "בלי זיהוי דירה" }),                        // ללא דירה
]);
const row9 = s.rows.find((r) => r.number === "9")!;
ok("structured + note combine on apartment 9", row9.paidAg === 75100 && row9.items.length === 2);
ok("structured attribution wins over note", row9.items.find((i) => i.amount === 500)?.via === "structured");
ok("note attribution is marked", row9.items.find((i) => i.amount === 251)?.via === "note");
const row4 = s.rows.find((r) => r.number === "4")!;
ok("note-only attribution lands on apartment 4", row4.paidAg === 50000 && row4.items[0]?.via === "note");
ok("apartment without payments has no record", s.rows.find((r) => r.number === "1")?.paidAg === 0 && levyState(s.rows.find((r) => r.number === "1")!.paidAg) === "none");
ok("unidentified allocation is unassigned but counted", s.unassigned.length === 1 && s.unassigned[0].amount === 100);
ok("total always adds up", s.totalAg === 50000 + 25100 + 50000 + 10000 && s.totalAg === s.rows.reduce((x, r) => x + r.paidAg, 0) + s.unassigned.reduce((x, i) => x + Math.round(i.amount * 100), 0));
ok("purpose constant is the canonical string", LEVY_PURPOSE === "שיפור הבניין");

// ניסוח ישן מאומת: נספר באותה גבייה ונשמר עם תווית המטרה המקורית
const s2 = summarizeLevy(apts, [al({}), al({ amount: 500, purpose: LEVY_PURPOSE_LEGACY, basis_note: "דירה 1" })]);
ok("legacy wording counts in the levy total", s2.totalAg === 100000);
ok("legacy wording lands on its noted apartment", s2.rows.find((r) => r.number === "1")?.paidAg === 50000 && levyState(s2.rows.find((r) => r.number === "1")!.paidAg) === "full");
ok("legacy item keeps its original purpose label", s2.rows.find((r) => r.number === "1")?.items[0]?.purpose === LEVY_PURPOSE_LEGACY);
ok("legacy wording is not in other-purposes", s2.otherPurposes.length === 0);

// מטרה אחרת באמת: לא נספרת, מוצגת בנפרד
const s3 = summarizeLevy(apts, [al({}), al({ amount: 200, purpose: "תרומה לגינה" })]);
ok("unrelated purpose is not counted", s3.totalAg === 50000);
ok("unrelated purpose is grouped separately", s3.otherPurposes.length === 1 && s3.otherPurposes[0].purpose === "תרומה לגינה" && s3.otherPurposes[0].totalAg === 20000);

console.log(fails ? `${fails} FAILED` : "all passed");
if (fails) process.exit(1);
