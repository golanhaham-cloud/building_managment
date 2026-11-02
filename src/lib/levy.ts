// מעקב אחר הגבייה החד-פעמית לשיפור הבניין (יעד התייחסות: 500 ש"ח לדירה).
// הגבייה נרשמת כשיוכי "מטרה מיוחדת" עם המטרה LEVY_PURPOSE בדיוק. דמי ועד חודשיים נפרדים לחלוטין.
// העמוד תצוגה בלבד: "אין רישום" אינו חוב - ייתכן שהתשלום שולם וטרם שויך, או שקיים הסדר אחר.
// אין טבלת יעדים במסד: היעד הוא קבוע תצוגה בלבד, והוא אינו חיוב.

import { toAg } from "./allocations";

export const LEVY_PURPOSE = "שיפור הבניין";
export const LEVY_TARGET_AG = 50000; // 500 ש"ח באגורות

export type LevyAlloc = {
  id: string;
  amount: number; // ש"ח, כפי שנשמר במסד
  apartment_id: string | null; // שיוך מובנה לדירה (שיוכים חדשים)
  basis_note: string | null;
  date: string | null; // תאריך קבלת ההכנסה המקורית
  created_at: string | null;
};

// זיהוי דירה בהערת בסיס ישנה, לשיוכים שנשמרו לפני שהטופס אפשר בחירת דירה למטרה מיוחדת.
// רק "דירה N" מפורש נחשב זיהוי; כל מספר אחר בהערה (סכום, תאריך, חלק) אינו דירה.
export function apartmentFromNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const m = note.match(/דירה\s+(\d{1,2})(?!\d)/);
  return m ? m[1] : null;
}

export type LevyState = "full" | "partial" | "none";
export const LEVY_STATE_LABELS: Record<LevyState, string> = {
  full: "שולם במלואו",
  partial: "שולם חלקית",
  none: "אין רישום",
};

export function levyState(paidAg: number): LevyState {
  if (paidAg <= 0) return "none";
  return paidAg >= LEVY_TARGET_AG ? "full" : "partial";
}

export type LevyItem = { id: string; amount: number; date: string | null; via: "structured" | "note"; note: string | null };
export type LevyRow = { apartment_id: string; number: string; paidAg: number; items: LevyItem[] };
export type LevySummary = { rows: LevyRow[]; unassigned: LevyItem[]; totalAg: number };

// צבירה לפי דירה. שיוך מובנה (apartment_id) גובר על זיהוי מההערה. שיוך שלא נמצאה לו דירה
// מופיע ב-unassigned ועדיין נספר בסך "נגבה עד כה", כדי שהסכומים יסתדרו תמיד.
export function summarizeLevy(apartments: { id: string; number: string }[], allocs: LevyAlloc[]): LevySummary {
  const byId = new Map(apartments.map((a) => [a.id, a]));
  const byNumber = new Map(apartments.map((a) => [String(Number(a.number)), a]));
  const itemsById = new Map<string, LevyItem[]>();
  const unassigned: LevyItem[] = [];
  let totalAg = 0;
  for (const a of allocs) {
    totalAg += toAg(a.amount);
    let apt = a.apartment_id ? byId.get(a.apartment_id) : undefined;
    let via: LevyItem["via"] = "structured";
    if (!apt) {
      const num = apartmentFromNote(a.basis_note);
      apt = num ? byNumber.get(num) : undefined;
      via = "note";
    }
    const item: LevyItem = { id: a.id, amount: a.amount, date: a.date, via, note: a.basis_note ?? null };
    if (!apt) {
      unassigned.push(item);
      continue;
    }
    const arr = itemsById.get(apt.id) ?? [];
    arr.push(item);
    itemsById.set(apt.id, arr);
  }
  const rows = apartments.map((a) => {
    const items = (itemsById.get(a.id) ?? []).sort((x, y) => String(x.date).localeCompare(String(y.date)));
    return { apartment_id: a.id, number: a.number, paidAg: items.reduce((s, i) => s + toAg(i.amount), 0), items };
  });
  return { rows, unassigned, totalAg };
}
