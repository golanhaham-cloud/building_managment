import { groupByItem, parseTxIds, parseLinkFilters } from "../src/lib/forecast-links";
const fail = (m: string) => { console.error("FAIL " + m); process.exit(1); };
const rows = [
  { id: "a", date: "2026-09-10", amount: "1805.51", forecast_item_id: "I1" },
  { id: "b", date: "2026-08-10", amount: 1908.25, forecast_item_id: "I1" },
  { id: "c", date: "2026-08-17", amount: "1038.48", forecast_item_id: "I2" }, // חשמל חניון לא מתערבב
  { id: "d", date: "2026-10-01", amount: 5, forecast_item_id: "I1", voided_at: "2026-10-02" },
  { id: "e", date: "2026-09-10", amount: "0.10", forecast_item_id: "I1", created_at: "2026-09-11" },
  { id: "f", date: "2026-09-10", amount: "0.20", forecast_item_id: null },
];
const g = groupByItem(rows);
const i1 = g.get("I1")!;
if (i1.rows.map((r) => r.id).join() !== "e,a,b") fail("order " + i1.rows.map((r) => r.id));
if (i1.count !== 3 || i1.totalAgorot !== 180551 + 190825 + 10) fail("total " + i1.totalAgorot);
if (g.get("I2")!.count !== 1 || g.get("I2")!.rows[0].id !== "c" || g.has("null")) fail("separation");
if (parseTxIds([]).error === null || parseTxIds(["x"]).error === null) fail("ids invalid");
const u = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";
const p = parseTxIds([u, u, ` ${u} `]); if (p.error || p.ids.length !== 1) fail("dedupe");
if (parseTxIds(Array.from({ length: 201 }, (_, i) => u.slice(0, -3) + String(100 + i))).error === null) fail("max");
if (parseLinkFilters({}).show !== "unlinked" || parseLinkFilters({ show: "all" }).show !== "all" || parseLinkFilters({ show: "zzz" }).show !== "unlinked") fail("filters");
console.log("forecast-links tests passed");
