import { balanceBreakdown } from "../src/lib/opening-balance";
let fails = 0;
function ok(n: string, c: boolean) { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; }
const row = { current_balance: "8756.63", opening_balance: "3653.50", opening_start_date: "2024-12-01", net_since_start: "5103.13", last_transaction_date: "2026-10-16", excluded_before_start: 0 };
const b = balanceBreakdown(row);
ok("3,653.50 + 5,103.13 = 8,756.63", b.opening === 3653.5 && b.net === 5103.13 && b.balance === 8756.63 && b.consistent);
ok("last transaction date shown", b.lastTransactionDate === "2026-10-16" && b.startDate === "2024-12-01");
ok("breakdown follows new transactions (not a constant)", balanceBreakdown({ ...row, current_balance: "8856.63", net_since_start: "5203.13" }).consistent);
ok("a mismatching breakdown is detected", !balanceBreakdown({ ...row, current_balance: "9000" }).consistent);
const none = balanceBreakdown({ ...row, opening_balance: null, opening_start_date: null, current_balance: "5103.13" });
ok("no opening row: balance is net only", none.opening === null && none.consistent);
ok("excluded count reported", balanceBreakdown({ ...row, excluded_before_start: 3 }).excluded === 3);
ok("no float drift (0.1+0.2)", balanceBreakdown({ ...row, opening_balance: "0.1", net_since_start: "0.2", current_balance: "0.3" }).consistent);
ok("missing row does not throw", balanceBreakdown(null).balance === 0);
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
