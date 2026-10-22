// Display-only helpers: distinguish "not yet entered" from verified financial state.
// No amounts are computed or changed here beyond the existing formula (charges - recorded).

export const NO_TX_MESSAGE = "טרם הוזנו תנועות; יתרת הקופה אינה מאומתת";
export const PARTIAL_WARNING = "הרישום חלקי ואינו בהכרח משקף את החוב בפועל";

export function balanceDisplay(txCount: number, balance: number | null | undefined) {
  if (!txCount || txCount <= 0) return { verified: false as const, balance: null, message: NO_TX_MESSAGE };
  return { verified: true as const, balance: Number(balance ?? 0), message: null };
}

export type ReviewRow = { year: number; month: number; is_complete: boolean; created_at: string; created_by?: string | null };

// Latest review row for a month decides; no row = not reviewed.
export function latestReview(rows: ReviewRow[] | null | undefined, year: number, month: number) {
  const mine = (rows ?? []).filter((r) => r.year === year && r.month === month);
  if (!mine.length) return null;
  return mine.reduce((a, b) => (a.created_at >= b.created_at ? a : b));
}

export function paymentsSummary(args: { charges: number; recorded: number; reviewed: boolean }) {
  const { charges, recorded, reviewed } = args;
  return {
    charges,
    recorded,
    balance: Math.max(charges - recorded, 0), // same formula as before
    partial: !reviewed,
    warning: reviewed ? null : PARTIAL_WARNING,
    // Only a reviewed month may call an unpaid apartment "in debt".
    unpaidLabel: reviewed ? "לא שולם" : "טרם נרשם תשלום",
  };
}
