// יתרת פתיחה לחשבון הוועד: פירוט היתרה המחושבת. החישוב עצמו נעשה במסד (view building_balance);
// כאן רק פירוק לתצוגה, באגורות שלמות, כדי שהפירוט תמיד יסתכם ליתרה המוצגת.

export type BalanceRow = {
  current_balance: number | string | null;
  opening_balance: number | string | null;
  opening_start_date: string | null;
  net_since_start: number | string | null;
  last_transaction_date: string | null;
  excluded_before_start: number | string | null;
};

const ag = (n: number | string | null | undefined) => Math.round(Number(n ?? 0) * 100);

export function balanceBreakdown(r: BalanceRow | null | undefined) {
  const balanceAg = ag(r?.current_balance);
  const hasOpening = r?.opening_balance !== null && r?.opening_balance !== undefined;
  const openingAg = hasOpening ? ag(r!.opening_balance) : null;
  const netAg = ag(r?.net_since_start);
  return {
    balance: balanceAg / 100,
    opening: openingAg === null ? null : openingAg / 100,
    net: netAg / 100,
    startDate: r?.opening_start_date ?? null,
    lastTransactionDate: r?.last_transaction_date ?? null,
    excluded: Number(r?.excluded_before_start ?? 0),
    // הפירוט מסתכם ליתרה (אם אין יתרת פתיחה, היתרה היא נטו התנועות)
    consistent: (openingAg ?? 0) + netAg === balanceAg,
  };
}
