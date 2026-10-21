export const inp = "w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white";
export const lbl = "block text-xs text-gray-500 mb-0.5";
export const btnGhost = "w-full rounded-lg border border-gray-300 text-sm py-1.5";
export const btnDanger = "w-full rounded-lg bg-status-unpaid text-white text-sm py-1.5 disabled:opacity-60";
export function ils(n: number | null | undefined) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(Number(n ?? 0));
}
export function monthName(m: number) {
  return ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"][m - 1] ?? String(m);
}
