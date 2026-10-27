// שמות הדיירים ליד מספר הדירה בעמוד הגבייה. אותם כללים כמו מסך הדירות (get_resident_directory):
// מוצגים רק מי שמתגורר בדירה (lives_here); שוכר מסומן "(שוכר/ת)"; בעלים שאינו מתגורר בדירה אינו מחליף שוכר ואינו מוצג כאן.
// בלי שמות בקוד: הכול מהנתונים. אם אין שם, הקורא מציג רק "דירה X".
export type DirectoryPerson = { apartment_id: string; full_name: string | null; lives_here: boolean | null; ownership: string | null; is_primary_contact?: boolean | null };

export function livingResidentLabels(apartmentId: string, people: DirectoryPerson[]): string[] {
  return people
    .filter((r) => r.apartment_id === apartmentId && r.lives_here && String(r.full_name ?? "").trim())
    .map((r) => `${String(r.full_name).trim()}${r.ownership === "tenant" ? " (שוכר/ת)" : ""}`);
}

export function peopleByApartment(people: DirectoryPerson[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const id of new Set(people.map((p) => p.apartment_id))) {
    const l = livingResidentLabels(id, people);
    if (l.length) out.set(id, l);
  }
  return out;
}
