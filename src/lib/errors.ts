export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String((e as any)?.message ?? e ?? "");
  if (/duplicate key/i.test(raw)) {
    if (/apartments/i.test(raw)) return "מספר הדירה כבר קיים בבניין.";
    return "הרשומה כבר קיימת.";
  }
  if (/permission denied|row-level security/i.test(raw)) return "אין לך הרשאה לבצע פעולה זו.";
  if (/violates check constraint/i.test(raw)) return "ערך לא תקין בטופס. בדוק את השדות ונסה שוב.";
  if (/invalid input syntax/i.test(raw)) return "ערך לא תקין בטופס.";
  const stripped = raw.replace(/^[A-Z_]{4,}:\s*/, "");
  return stripped || "אירעה שגיאה. נסה שוב.";
}

export const OCCUPANCY_LABELS: Record<string, string> = {
  owner_occupied: "בבעלות המתגורר",
  rented: "מושכרת",
  vacant: "ריקה",
};
