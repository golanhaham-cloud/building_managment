// Display-only helpers: distinguish "not yet entered" from verified financial state.
// No amounts are computed or changed here beyond the existing formula (charges - recorded).

export const NO_TX_MESSAGE = "טרם הוזנו תנועות; יתרת הקופה אינה מאומתת";
export const PARTIAL_WARNING = "הרישום חלקי ואינו בהכרח משקף את החוב בפועל";
export const NEUTRAL_NOTE = "רישום חלקי - אין להסיק ממנו חוב בפועל";

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
    // Same formula as before; shown only once the committee confirmed the month is complete.
    balance: reviewed ? Math.max(charges - recorded, 0) : null,
    partial: !reviewed,
    warning: reviewed ? null : PARTIAL_WARNING,
    note: reviewed ? null : NEUTRAL_NOTE,
      };
}

// Per-apartment marker. Until the committee confirms the month: neutral (never red), and
// "no payment" is worded "not yet recorded", never "unpaid". A fully paid apartment shows as paid.
export function rowState(args: { reviewed: boolean; paid: number; due: number }): { label: string; dot: "paid" | "partial" | "unpaid" | "neutral"; debt: boolean } {
  const { reviewed, paid, due } = args;
  if (paid >= due && due > 0) return { label: "שולם", dot: "paid", debt: false };
  if (!reviewed) return { label: paid > 0 ? "נרשם תשלום חלקי" : "טרם נרשם תשלום", dot: "neutral", debt: false };
  return paid > 0 ? { label: "שולם חלקית", dot: "partial", debt: true } : { label: "לא שולם", dot: "unpaid", debt: true };
}

// Floors ascending, then apartment number numerically ascending ("9" before "10").
export function sortByFloorThenNumber<T>(rows: T[], floorOf: (r: T) => number, numberOf: (r: T) => string | number): T[] {
  return [...rows].sort((a, b) => floorOf(a) - floorOf(b) || Number(numberOf(a)) - Number(numberOf(b)));
}
