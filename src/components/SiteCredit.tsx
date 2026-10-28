// קרדיט האתר: רכיב יחיד שמוצג בתחתית כל עמוד (מוכנס פעם אחת ב-layout הראשי). טקסט בלבד, בלי קישור ובלי אנימציה.
// הריווח התחתון משאיר מקום לסרגל הניווט התחתון הקבוע; בעמודים בלי סרגל (כניסה והרשמה) הריווח קטן יותר (ראו globals.css).
export const SITE_CREDIT_TEXT = "האתר נבנה על ידי גולן חכם";

export default function SiteCredit() {
  return (
    <footer data-site-credit className="site-credit text-center text-xs text-gray-600 px-4 pt-6">
      {SITE_CREDIT_TEXT}
    </footer>
  );
}
