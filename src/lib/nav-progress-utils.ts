// החלטה טהורה: האם שליחת טופס היא ניווט עמוד מלא (לשם מד ההתקדמות העליון).
// טפסי server action של React מוצגים ב-DOM עם action="javascript:..." ובלי מאפיין method
// (ולכן method במודל ה-DOM הוא "get"), אבל אינם ניווט - הם נשלחים ב-fetch פנימי של React.
// ללא הבדיקה הזו מד הטעינה "נתקע" אחרי כל שמירה: אף ניווט לא מתרחש, אף fetch של נתוני
// עמוד לא נצפה, וההודעה נשארת עד הוויתור (25 שניות) ואז מוצגת שגיאה אדומה שגויה.

export function formNavKey(method: string | null, target: string | null, action: string, currentHref: string): string | null {
  if ((method || "get").toLowerCase() !== "get" || target) return null;
  let u: URL;
  try {
    u = new URL(action || currentHref, currentHref);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null; // javascript: (server action), mailto: וכדומה
  return u.href;
}
