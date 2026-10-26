// כרטיס גביית ועד בדשבורד: אותו חישוב של מסך התשלומים (month_fee_overview):
// חיוב לחודש = חיוב בסיס + חיובים נוספים − זיכויים. הכול באגורות שלמות.
// מצב "שולם" נקבע לפי החיוב המעודכן, לא לפי הבסיס בלבד.
import { rowState } from "./completeness";

export type OverviewRow = {
  apartment_id: string;
  has_charge: boolean;
  charge_amount: number | string | null;
  adjustments_total: number | string | null; // null = לא נחשף (דייר)
  paid_amount: number | string | null;
  status?: string | null;
};

const ag = (n: number | string | null | undefined) => Math.round(Number(n ?? 0) * 100);

export type CollectionRow = {
  apartment_id: string;
  due: number; // חיוב לחודש (₪)
  paid: number; // שולם (₪)
  full: boolean;
  partial: boolean;
  state: ReturnType<typeof rowState>;
};

export function collectionRow(r: OverviewRow, reviewed: boolean): CollectionRow {
  const adjKnown = r.adjustments_total !== null && r.adjustments_total !== undefined;
  const dueAg = ag(r.charge_amount) + ag(r.adjustments_total);
  const paidAg = ag(r.paid_amount);
  const due = dueAg / 100;
  const paid = paidAg / 100;
  // לוועד: לפי החיוב המעודכן. לדייר ההתאמות אינן חשופות, ולכן הסטטוס שחושב במסד (לפי החיוב המעודכן) קובע.
  const full = adjKnown ? dueAg > 0 && paidAg >= dueAg : r.status === "paid" && paidAg > 0;
  const partial = !full && paidAg > 0;
  // סכום חלקי אינו תשלום מלא; ללא אישור הוועד שהחודש נבדק, אין להסיק מהפער חוב מאומת.
  const state = full
    ? { label: "שולם", dot: "paid" as const, debt: false }
    : partial
      ? reviewed
        ? { label: "שולם חלקית", dot: "partial" as const, debt: true }
        : { label: "נרשם תשלום חלקי", dot: "neutral" as const, debt: false }
      : rowState({ reviewed, paid: 0, due });
  return { apartment_id: r.apartment_id, due, paid, full, partial, state };
}

export function collectionSummary(rows: OverviewRow[], reviewed: boolean) {
  const list = rows.filter((r) => r.has_charge).map((r) => collectionRow(r, reviewed));
  const dueAg = list.reduce((s, r) => s + Math.round(r.due * 100), 0);
  const paidAg = list.reduce((s, r) => s + Math.round(r.paid * 100), 0);
  const count = list.length;
  const fullCount = list.filter((r) => r.full).length;
  return { list, count, fullCount, due: dueAg / 100, paid: paidAg / 100, pct: count ? Math.round((fullCount / count) * 100) : 0 };
}
