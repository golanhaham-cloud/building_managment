// Pure forecast math (no I/O). All money is handled in agorot (integers) to avoid floating-point drift.
// The forecast is planning data only: it is NOT a bank balance and creates no transactions, charges or payments.

export type FeeGroup = { fee_amount: number | null; apartment_count: number };
export type ForecastItem = { id: string; monthly_estimate: number; is_active: boolean };
export type ForecastOneOff = { year: number; month: number; amount: number; voided_at: string | null };
export type Scenario = { fee_amount: number; non_paying: number };
export type MonthKey = { year: number; month: number };

export const toAgorot = (n: number | string | null | undefined) => Math.round(Number(n ?? 0) * 100);
export const fromAgorot = (a: number) => a / 100;

/** The next three calendar months after the current month, by Israel time. */
export function nextThreeMonths(now: Date = new Date()): MonthKey[] {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  return [1, 2, 3].map((i) => {
    const idx = m - 1 + i;
    return { year: y + Math.floor(idx / 12), month: (idx % 12) + 1 };
  });
}

export type GroupRow = { fee_amount: number; apartment_count: number; non_paying: number; applied: number; reduction_agorot: number; full_agorot: number };

/** Dues for one month from tariff groups. The scenario count is capped at the group size and priced at that month's tariff. */
export function duesForMonth(groups: FeeGroup[], scenarios: Scenario[]) {
  let full = 0;
  let reduction = 0;
  let unpriced = 0;
  const rows: GroupRow[] = [];
  for (const g of groups) {
    if (g.fee_amount === null || g.fee_amount === undefined) { unpriced += g.apartment_count; continue; }
    const fee = toAgorot(g.fee_amount);
    const asked = scenarios.find((s) => toAgorot(s.fee_amount) === fee)?.non_paying ?? 0;
    const applied = Math.max(0, Math.min(asked, g.apartment_count));
    const f = fee * g.apartment_count;
    const r = fee * applied;
    full += f; reduction += r;
    rows.push({ fee_amount: g.fee_amount, apartment_count: g.apartment_count, non_paying: asked, applied, reduction_agorot: r, full_agorot: f });
  }
  return { full_agorot: full, reduction_agorot: reduction, expected_agorot: full - reduction, unpriced_apartments: unpriced, rows };
}

export function recurringTotalAgorot(items: ForecastItem[]) {
  return items.filter((i) => i.is_active).reduce((s, i) => s + toAgorot(i.monthly_estimate), 0);
}

export function oneOffsForMonth(oneOffs: ForecastOneOff[], m: MonthKey) {
  return oneOffs.filter((o) => !o.voided_at && o.year === m.year && o.month === m.month).reduce((s, o) => s + toAgorot(o.amount), 0);
}

export function forecastMonth(args: { groups: FeeGroup[]; scenarios: Scenario[]; items: ForecastItem[]; oneOffs: ForecastOneOff[]; refund: number; month: MonthKey }) {
  const dues = duesForMonth(args.groups, args.scenarios);
  const refund = toAgorot(args.refund);
  const recurring = recurringTotalAgorot(args.items);
  const oneOff = oneOffsForMonth(args.oneOffs, args.month);
  const income = dues.expected_agorot + refund;
  const expenses = recurring + oneOff;
  return { month: args.month, dues, refund_agorot: refund, income_agorot: income, recurring_agorot: recurring, one_off_agorot: oneOff, expenses_agorot: expenses, diff_agorot: income - expenses };
}
