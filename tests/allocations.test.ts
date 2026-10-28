import { availableAfterAg, basisIsConfirmed, monthProgress, nextMonth, rowsTotalAg, toAg, toRpcItems, validateRows, type AllocRow } from "../src/lib/allocations";

let fails = 0;
function ok(n: string, c: boolean) { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; }
const row = (o: Partial<AllocRow> = {}): AllocRow => ({
  key: "k" + Math.random(), kind: "fee", apartment_id: "a1", year: 2025, month: 10, purpose: "", amount: "290",
  apartment_basis: "payer_note", months_basis: "explicit", basis_note: "", ...o,
});

// 870 ₪ מכסה אוקטובר–דצמבר ב-290 לכל חודש
const three = [row({ month: 10 }), row({ month: 11 }), row({ month: 12 })];
ok("3x290 totals 870 agorot-exact", rowsTotalAg(three) === 87000);
ok("3x290 against 870 leaves 0", availableAfterAg(toAg(870), three) === 0);
ok("3x290 against 870 is valid", validateRows(three, toAg(870)) === null);
ok("a 4th row exceeds the source", validateRows([...three, row({ month: 1, year: 2026, amount: "0.01" })], toAg(870)) !== null);
ok("no floating-point drift (0.1+0.2)", rowsTotalAg([row({ amount: "0.1" }), row({ amount: "0.2" })]) === 30);

// מטרה מיוחדת: בלי דירה/חודש, לא נספרת כתשלום חודשי
const sp = row({ kind: "special", apartment_id: "", apartment_basis: "", months_basis: "", purpose: "שיפור מראה הבניין", amount: "500" });
ok("special-purpose row valid without month/apartment", validateRows([sp], toAg(500)) === null);
ok("special purpose needs a purpose", validateRows([{ ...sp, purpose: " " }], toAg(500)) !== null);
const items = toRpcItems([sp]);
ok("special item carries no month/apartment", items[0].kind === "special" && !("month" in items[0]) && !("apartment_id" in items[0]));

// תשלום חלקי
const p200 = monthProgress(290, 200);
ok("200 of 290 is partial, not full", p200.state === "partial" && p200.label === "תשלום חלקי" && p200.remainingAg === 9000);
ok("290 of 290 is full", monthProgress(290, 290).state === "full");
ok("0 of 290 is none", monthProgress(290, 0).state === "none");
ok("zero charge with zero paid is never 'full'", monthProgress(0, 0).state === "none");

// בסיסים: משוער ושטרם הובהר אינם מאושרים ודורשים הערה
ok("payer_note and explicit are confirmed", basisIsConfirmed("payer_note") && basisIsConfirmed("explicit"));
ok("estimated is NOT confirmed", !basisIsConfirmed("estimated"));
ok("unclarified is NOT confirmed", !basisIsConfirmed("unclarified"));
ok("estimated without a note is rejected", validateRows([row({ months_basis: "estimated" })], toAg(290)) !== null);
ok("estimated with a note is accepted", validateRows([row({ months_basis: "estimated", basis_note: "לפי החודשים הפתוחים" })], toAg(290)) === null);
ok("apartment confirmed does not confirm months (kept separate)", (() => {
  const r = row({ apartment_basis: "explicit", months_basis: "unclarified", basis_note: "טרם הובהר" });
  const it: any = toRpcItems([r])[0];
  return it.apartment_basis === "explicit" && it.months_basis === "unclarified" && !basisIsConfirmed(it.months_basis);
})());
ok("missing basis is rejected", validateRows([row({ apartment_basis: "" })], toAg(290)) !== null && validateRows([row({ months_basis: "" })], toAg(290)) !== null);
ok("same apartment+month twice is rejected", validateRows([row(), row()], toAg(870)) !== null);
ok("amount sent as string (no precision loss)", (toRpcItems([row({ amount: "290.10" })])[0] as any).amount === "290.10");
ok("3 decimals rejected", validateRows([row({ amount: "1.234" })], toAg(870)) !== null);
ok("nextMonth rolls the year", JSON.stringify(nextMonth(2025, 12)) === '{"year":2026,"month":1}' && nextMonth(2025, 10).month === 11);
ok("empty rows rejected", validateRows([], toAg(870)) !== null);

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);

// סיבת ביטול הקצאה
import { validateVoidReason } from "../src/lib/allocations";
if (validateVoidReason("") !== "יש להזין סיבת ביטול" || validateVoidReason("  ") !== "יש להזין סיבת ביטול") { console.error("FAIL void reason empty"); process.exit(1); }
if (!validateVoidReason("אב") || validateVoidReason("הוזן בטעות") !== null || !validateVoidReason("א".repeat(501))) { console.error("FAIL void reason rules"); process.exit(1); }
console.log("ok   void reason validation");
