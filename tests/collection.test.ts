import { collectionRow, collectionSummary, type OverviewRow } from "../src/lib/collection";
let fails = 0;
function ok(n: string, c: boolean) { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; }
const r = (id: string, base: number, adj: number | null, paid: number, status = "unpaid"): OverviewRow => ({ apartment_id: id, has_charge: true, charge_amount: base, adjustments_total: adj, paid_amount: paid, status });

// אוקטובר 2026 (נתוני הייצור): 19 דירות
const rows: OverviewRow[] = [
  r("1", 290, 40, 330, "paid"), r("2", 290, 40, 330, "paid"), r("3", 225, 40, 265, "paid"), r("4", 290, 40, 330, "paid"),
  r("5", 290, 40, 290, "partial"), r("6", 225, 40, 265, "paid"), r("7", 290, 40, 330, "paid"), r("8", 290, 40, 0),
  r("9", 225, 40, 265, "paid"), r("10", 290, 40, 290, "partial"), r("11", 290, 40, 0), r("12", 225, 40, 265, "paid"),
  r("13", 290, 40, 0), r("14", 290, 40, 0), r("15", 225, 40, 225, "partial"), r("16", 290, 40, 0),
  r("17", 290, 40, 290, "partial"), r("18", 364, -1, 364, "paid"), r("19", 364, -1, 0),
];
const s = collectionSummary(rows, false);
ok("total charges Oct 2026 = 6,011 (base + adjustments)", s.due === 6011);
ok("19 apartments with a charge", s.count === 19);
const a1 = collectionRow(rows[0], false), a2 = collectionRow(rows[1], false);
ok("apt 1: paid 330, due 330, full", a1.paid === 330 && a1.due === 330 && a1.full && a1.state.label === "שולם");
ok("apt 2: paid 330, due 330, full", a2.paid === 330 && a2.due === 330 && a2.full);
const p290 = collectionRow(r("x", 290, 40, 290), false);
ok("290 paid vs 330 due is partial, not full", !p290.full && p290.partial && p290.state.label === "נרשם תשלום חלקי");
ok("290 vs 330 stays partial once reviewed too", collectionRow(r("x", 290, 40, 290), true).state.label === "שולם חלקית");
const full = rows.filter((x, i) => [0, 1, 2, 3, 5, 6, 8, 11, 17].includes(i));
ok("fully paid = 9 (1,2,3,4,6,7,9,12,18)", s.fullCount === 9 && full.length === 9);
ok("overpay vs base (330 on 290 base) is not shown as 'more than due'", a1.due === 330);
const res = collectionRow(r("y", 225, null, 225, "partial"), false);
ok("resident (adjustments hidden): DB status decides, partial stays partial", !res.full && res.partial);
ok("resident: DB status paid -> full", collectionRow(r("z", 290, null, 330, "paid"), false).full);
ok("no charge rows are excluded", collectionSummary([{ ...r("n", 0, 0, 0), has_charge: false }], false).count === 0);
ok("no float drift", collectionSummary([r("a", 0.1, 0.2, 0.3, "paid")], false).due === 0.3);
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
