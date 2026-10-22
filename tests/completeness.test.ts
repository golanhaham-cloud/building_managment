import { balanceDisplay, paymentsSummary, latestReview, rowState, sortByFloorThenNumber, NEUTRAL_NOTE, NO_TX_MESSAGE, PARTIAL_WARNING } from "../src/lib/completeness";
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.error("FAIL", m, a, b); process.exit(1); } console.log("ok  ", m); };

// 1. no data (mock)
eq(balanceDisplay(0, 0).verified, false, "no tx: balance not verified");
eq(balanceDisplay(0, 0).message, NO_TX_MESSAGE, "no tx: message");
eq(balanceDisplay(0, 0).balance, null, "no tx: no invented 0");
let s = paymentsSummary({ charges: 5333, recorded: 0, reviewed: false });
eq(s.warning, PARTIAL_WARNING, "no data: partial warning");
eq(rowState({ reviewed: false, paid: 0, due: 364 }).label, "טרם נרשם תשלום", "no data: not labelled debt");
// 2. partial: one payment added, month not marked reviewed
s = paymentsSummary({ charges: 5333, recorded: 364, reviewed: false });
eq([s.partial, s.balance], [true, null], "partial: still partial after one payment, no balance shown");
// 3. complete with true zero payments
eq(latestReview([{ year: 2026, month: 10, is_complete: true, created_at: "2026-10-30" }], 2026, 10)?.is_complete, true, "review found");
s = paymentsSummary({ charges: 5333, recorded: 0, reviewed: true });
eq([s.partial, s.warning, s.balance, rowState({ reviewed: true, paid: 0, due: 364 }).label], [false, null, 5333, "לא שולם"], "reviewed, zero real payments shown normally");
// 4. complete with true zero balance
s = paymentsSummary({ charges: 5333, recorded: 5333, reviewed: true });
eq([s.partial, s.balance], [false, 0], "complete, true zero balance");
eq(balanceDisplay(3, 0), { verified: true, balance: 0, message: null }, "with tx, real 0 shows as 0");
// reopen: latest row wins
eq(latestReview([{ year: 2026, month: 10, is_complete: true, created_at: "2026-10-30" }, { year: 2026, month: 10, is_complete: false, created_at: "2026-11-01" }], 2026, 10)?.is_complete, false, "latest row wins");

// neutral row markers until reviewed
eq(rowState({ reviewed: false, paid: 0, due: 364 }), { label: "טרם נרשם תשלום", dot: "neutral", debt: false }, "unreviewed zero: neutral, not 'unpaid'");
eq(rowState({ reviewed: false, paid: 100, due: 364 }).dot, "neutral", "unreviewed partial: neutral");
eq(rowState({ reviewed: false, paid: 364, due: 364 }).dot, "paid", "fully paid shows paid");
eq(rowState({ reviewed: true, paid: 0, due: 364 }), { label: "לא שולם", dot: "unpaid", debt: true }, "reviewed zero: normal debt display");
eq(rowState({ reviewed: true, paid: 0, due: 0 }).debt, true, "reviewed zero due edge");
eq(paymentsSummary({ charges: 5333, recorded: 0, reviewed: false }).note, NEUTRAL_NOTE, "neutral note");
eq(paymentsSummary({ charges: 5333, recorded: 0, reviewed: true }).balance, 5333, "reviewed: balance shown");
// ordering
const rows = [[2,"2"],[1,"1"],[1,"10"],[2,"8"],[2,"6"],[2,"7"],[1,"9"],[3,"19"],[3,"18"]].map(([f,n]) => ({ f, n }));
eq(sortByFloorThenNumber(rows, (r: any) => r.f, (r: any) => r.n).map((r: any) => `${r.f}:${r.n}`), ["1:1","1:9","1:10","2:2","2:6","2:7","2:8","3:18","3:19"], "numeric order within floor ('9' before '10')");
