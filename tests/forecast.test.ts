import { duesForMonth, forecastMonth, nextThreeMonths, recurringTotalAgorot, fromAgorot, type ForecastItem } from "../src/lib/forecast";
let fails = 0;
function ok(n: string, c: boolean) { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; }
// Tariff groups as they stand today for November 2026: 5 three-room apartments at 270, 14 five-room at 335.
const nov = [{ fee_amount: 270, apartment_count: 5 }, { fee_amount: 335, apartment_count: 14 }];
ok("November dues, full collection = 6,040", fromAgorot(duesForMonth(nov, []).expected_agorot) === 6040);
ok("one 335 apartment not paying = 5,705", fromAgorot(duesForMonth(nov, [{ fee_amount: 335, non_paying: 1 }]).expected_agorot) === 5705);
ok("scenario is capped at group size", fromAgorot(duesForMonth(nov, [{ fee_amount: 270, non_paying: 99 }]).expected_agorot) === 6040 - 5 * 270);
ok("scenario applies at each month's own tariff", fromAgorot(duesForMonth([{ fee_amount: 340, apartment_count: 14 }], [{ fee_amount: 340, non_paying: 2 }]).reduction_agorot) === 680);
ok("scenario for a tariff that does not exist that month has no effect", duesForMonth(nov, [{ fee_amount: 999, non_paying: 3 }]).reduction_agorot === 0);
ok("apartments without a tariff are reported, not priced", duesForMonth([{ fee_amount: null, apartment_count: 2 }], []).unpriced_apartments === 2);
const items: ForecastItem[] = [2011, 1400, 932, 276, 146.24, 163, 24.57, 33, 46, 29].map((a, i) => ({ id: String(i), monthly_estimate: a, is_active: true }));
ok("opening items total = 5,060.81 (computed from rows)", fromAgorot(recurringTotalAgorot(items)) === 5060.81);
ok("stopped item is excluded", fromAgorot(recurringTotalAgorot([...items, { id: "x", monthly_estimate: 100, is_active: false }])) === 5060.81);
const m = forecastMonth({ groups: nov, scenarios: [], items, oneOffs: [{ year: 2026, month: 12, amount: 1500, voided_at: null }, { year: 2026, month: 12, amount: 700, voided_at: "2026-10-01" }], refund: 222, month: { year: 2026, month: 11 } });
ok("November: income 6,262, expenses 5,060.81, diff 1,201.19", fromAgorot(m.income_agorot) === 6262 && fromAgorot(m.expenses_agorot) === 5060.81 && fromAgorot(m.diff_agorot) === 1201.19);
const d = forecastMonth({ groups: nov, scenarios: [], items, oneOffs: [{ year: 2026, month: 12, amount: 1500, voided_at: null }, { year: 2026, month: 12, amount: 700, voided_at: "2026-10-01" }], refund: 222, month: { year: 2026, month: 12 } });
ok("one-off applies only to its month and voided ones are ignored", fromAgorot(d.one_off_agorot) === 1500 && fromAgorot(m.one_off_agorot) === 0);
ok("refund change moves the forecast", fromAgorot(forecastMonth({ groups: nov, scenarios: [], items, oneOffs: [], refund: 100, month: { year: 2026, month: 11 } }).income_agorot) === 6140);
ok("rolling months from Oct 2026 (Israel) = Nov, Dec, Jan", JSON.stringify(nextThreeMonths(new Date("2026-10-25T20:00:00Z"))) === JSON.stringify([{ year: 2026, month: 11 }, { year: 2026, month: 12 }, { year: 2027, month: 1 }]));
ok("Israel midnight boundary: 31 Oct 22:30 UTC is already November in Israel", nextThreeMonths(new Date("2026-10-31T22:30:00Z"))[0].month === 12);
ok("year rollover Nov 2026 -> Dec, Jan, Feb", JSON.stringify(nextThreeMonths(new Date("2026-11-15T10:00:00Z"))) === JSON.stringify([{ year: 2026, month: 12 }, { year: 2027, month: 1 }, { year: 2027, month: 2 }]));
process.exit(fails ? 1 : 0);
