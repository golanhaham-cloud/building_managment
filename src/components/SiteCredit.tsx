// קרדיט האתר: רכיב יחיד שמוצג בתחתית כל עמוד (מוכנס פעם אחת ב-layout הראשי). כולל גם את מייל הוועד ליצירת קשר.
// הריווח התחתון משאיר מקום לסרגל הניווט התחתון הקבוע; בעמודים בלי סרגל (כניסה והרשמה) הריווח קטן יותר (ראו globals.css).
export const SITE_CREDIT_TEXT = "האתר נבנה על ידי גולן חכם";
export const VAAD_EMAIL = "Livne6n@gmail.com";

export default function SiteCredit() {
  return (
    <footer data-site-credit className="site-credit text-center text-xs text-gray-600 px-4 pt-6">
      <p>
        ליצירת קשר עם הוועד:{" "}
        <a href={`mailto:${VAAD_EMAIL}`} dir="ltr" className="underline">
          {VAAD_EMAIL}
        </a>
      </p>
      <p>{SITE_CREDIT_TEXT}</p>
    </footer>
  );
}
