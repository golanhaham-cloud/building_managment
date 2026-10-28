import { parseFilters, filterTransactions, summarize, isFiltered, activeCount, EMPTY_FILTERS, type TxRow } from "../src/lib/tx-filter";
const fail = (m: string) => { console.error("FAIL " + m); process.exit(1); };
const R = (o: Partial<TxRow> & { id: string }): TxRow => ({ type: "income", date: "2026-10-06", amount: 100, description: "", ...o });
const rows: TxRow[] = [
  R({ id: "1", amount: 530, description: "בן ארי יצחק ועד בית עבור ספטמבר אוקטובר", date: "2026-10-06" }),
  R({ id: "2", amount: 0.1, description: "קטן א", date: "2026-10-07" }),
  R({ id: "3", amount: 0.2, description: "קטן ב", date: "2026-10-08" }),
  R({ id: "4", type: "expense", amount: 300, description: "ניקיון", category_id: "c1", categories: { name: "ניקיון" }, date: "2026-09-02" }),
  R({ id: "5", type: "expense", amount: 50, description: "ניקיון בוטל", category_id: "c1", voided_at: "2026-09-03", date: "2026-09-03" }),
  R({ id: "6", amount: 400, description: "העברה מאת: כהן", date: "2025-10-10", apartments: { apartment_number: 5 } }),
];
const alloc = new Map<string, Set<string>>([["1", new Set(["12"])]]);
const F = (o: any) => parseFilters(o);
const ids = (f: any) => filterTransactions(rows, F(f), alloc).map((r) => r.id).join(",");
if (ids({}) !== "1,2,3,4,5,6" || isFiltered(F({}))) fail("empty");
if (ids({ q: "יצחק" }) !== "1" || ids({ q: "  בן   ארי " }) !== "1" || ids({ q: "ארי ספטמבר" }) !== "1" || ids({ q: "כהן" }) !== "6") fail("search");
if (ids({ q: "אין" }) !== "") fail("no result");
if (ids({ type: "expense" }) !== "4,5" || ids({ type: "income", year: "2026" }) !== "1,2,3") fail("type/year");
if (ids({ type: "bogus" }) !== "1,2,3,4,5,6") fail("bad type ignored");
if (ids({ cat: "c1" }) !== "4,5" || ids({ cat: "none" }) !== "1,2,3,6") fail("category");
if (ids({ year: "2026", month: "9" }) !== "4,5" || ids({ month: "10" }) !== "1,2,3,6") fail("period");
if (ids({ apt: "12" }) !== "1" || ids({ apt: "5" }) !== "6" || ids({ apt: "none" }) !== "2,3,4,5") fail("apartment");
if (ids({ type: "income", year: "2026", month: "10", apt: "12", q: "ארי" }) !== "1") fail("combo");
if (ids({ type: "income", apt: "12", q: "כהן" }) !== "") fail("combo empty");
const s = summarize(filterTransactions(rows, F({ year: "2026" }), alloc));
if (s.count !== 5 || s.voided !== 1 || s.incomeAgorot !== 53030 || s.expenseAgorot !== 30000 || s.netAgorot !== 23030) fail("summary " + JSON.stringify(s));
if (activeCount(F({ q: "a", type: "income", year: "2026" })) !== 3 || activeCount(EMPTY_FILTERS) !== 0) fail("count");
if (F({ year: "20x", month: "13" }).year !== "" || F({ month: "13" }).month !== "") fail("param sanitising");
console.log("tx-filter tests passed");
