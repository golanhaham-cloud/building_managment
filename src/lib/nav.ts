// ניווט: חמש לשוניות תחתונות לדייר ולוועד, ומסך "עוד" מקובץ. מקור אחד לשני המסכים (/more ו-/manage).
// אין כאן אכיפת הרשאות: כל עמוד ופעולה ממשיכים לאכוף הרשאות בשרת ובמסד כמו קודם. כאן נקבע רק מה מוצג למי.
export type TabId = "home" | "finance" | "residents" | "issues" | "more";

export const TABS: { id: TabId; href: string; label: string; icon: string }[] = [
  { id: "home", href: "/dashboard", label: "ראשי", icon: "🏠" },
  { id: "finance", href: "/finances", label: "כספים", icon: "💰" },
  { id: "residents", href: "/apartments", label: "דיירים", icon: "🏢" },
  { id: "issues", href: "/requests", label: "תקלות", icon: "🔧" },
  { id: "more", href: "/more", label: "עוד", icon: "☰" },
];

const under = (p: string, base: string) => p === base || p.startsWith(base + "/");

// איזו לשונית מסומנת בעמוד נתון, כולל עמודים פנימיים. עמודי כספים בניהול נחשבים "כספים"; כל השאר בניהול ו"עוד" נחשבים "עוד".
export function activeTab(pathname: string): TabId | null {
  const p = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  if (under(p, "/dashboard")) return "home";
  if (["/finances", "/payments", "/forecast", "/manage/fees", "/manage/collection", "/manage/opening-balance", "/manage/suppliers"].some((b) => under(p, b))) return "finance";
  if (under(p, "/apartments") || under(p, "/manage/apartments")) return "residents";
  if (under(p, "/requests")) return "issues";
  if (under(p, "/more") || under(p, "/manage") || ["/projects", "/announcements", "/account", "/changelog"].some((b) => under(p, b))) return "more";
  return null;
}

export type MoreItem = { href: string; icon: string; title: string; desc: string; admin?: boolean };
export type MoreGroup = { id: string; title: string; hint?: string; committee?: boolean; admin?: boolean; items: MoreItem[] };

export const MORE_GROUPS: MoreGroup[] = [
  {
    id: "finance", title: "כספים", admin: true,
    items: [
      { href: "/manage/fees", icon: "🧾", title: "תעריפים, חיובים וזיכויים", desc: "תעריף ועד לפי חודש, חיוב חודשי, זיכויים" },
      { href: "/payments", icon: "💳", title: "תשלומי ועד", desc: "רישום תשלומים שהתקבלו" },
      { href: "/payments/allocate", icon: "🔗", title: "שיוך הכנסה לדירה ולחודשים", desc: "שיוך הכנסה קיימת, בלי לספור פעמיים" },
      { href: "/manage/collection", icon: "📋", title: "מצב גבייה וחובות", desc: "פערים, הפחתות וחובות מאומתים לפי דירה וחודש" },
      { href: "/finances", icon: "💰", title: "הכנסות והוצאות", desc: "הוספה, תיקון וביטול עם סיבה" },
      { href: "/forecast", icon: "📈", title: "הוצאות קבועות ותחזית", desc: "אומדן חודשי, הנחות ותרחיש (לא יתרת בנק)" },
      { href: "/manage/opening-balance", icon: "🏁", title: "יתרת פתיחה", desc: "יתרה ותאריך תחילת רישום (לא תנועת הכנסה)" },
      { href: "/finances/import", icon: "🏦", title: "ייבוא מהבנק", desc: "ייבוא תנועות מקובץ" },
      { href: "/manage/suppliers", icon: "🧰", title: "ספקים", desc: "פרטי ספקים וחוזים" },
    ],
  },
  {
    id: "ops", title: "תפעול הבניין", admin: true,
    items: [
      { href: "/manage/apartments", icon: "🏢", title: "דירות ודיירים", desc: "בעלים, שוכרים, מצב דירה, היסטוריה" },
      { href: "/requests", icon: "🔧", title: "פניות ותקלות", desc: "עדכון סטטוס וטיפול" },
      { href: "/projects", icon: "📋", title: "תוכניות", desc: "תכנון ומעקב" },
      { href: "/announcements", icon: "📢", title: "הודעות", desc: "פרסום ועריכה" },
    ],
  },
  {
    id: "committee", title: "פרטי לוועד 🔒", admin: true, committee: true,
    hint: "אזור פרטי: גלוי לחברי ועד בלבד. ההרשאה נאכפת במסד הנתונים, לא רק בתצוגה.",
    items: [
      { href: "/manage/tasks", icon: "✅", title: "משימות ועד 🔒", desc: "אחראי, תאריך יעד, סטטוס והערות — פרטי לוועד" },
      { href: "/manage/documents", icon: "🗂️", title: "ארכיון מסמכי ועד 🔒", desc: "העלאה, פתיחה והורדה — פרטי לוועד" },
    ],
  },
  {
    id: "settings", title: "הגדרות ומערכת", admin: true,
    items: [
      { href: "/manage/join-requests", icon: "🙋", title: "בקשות הצטרפות", desc: "אישור או דחייה של דיירים חדשים" },
      { href: "/manage/users", icon: "🔐", title: "הרשאות משתמשים", desc: "ניהול תפקידי ועד" },
      { href: "/manage/audit", icon: "📜", title: "יומן שינויים", desc: "מי שינה מה ומתי" },
      { href: "/manage/deleted", icon: "🗑️", title: "נמחקו 🔒", desc: "הודעות ותקלות שנמחקו, עם שחזור" },
      { href: "/account", icon: "👤", title: "החשבון שלי", desc: "סיסמה ויציאה" },
      { href: "/changelog", icon: "🆕", title: "גרסאות ושינויים", desc: "מה השתנה בכל גרסה של האתר" },
    ],
  },
  {
    id: "building", title: "הבניין",
    items: [
      { href: "/projects", icon: "📋", title: "תוכניות", desc: "תוכניות ועבודות בבניין" },
      { href: "/announcements", icon: "📢", title: "הודעות", desc: "הודעות הבניין" },
      { href: "/forecast", icon: "📈", title: "תחזית", desc: "אומדן הוצאות חודשי (לא יתרת בנק)" },
    ],
  },
  {
    id: "account", title: "החשבון",
    items: [{ href: "/account", icon: "👤", title: "החשבון שלי", desc: "סיסמה ויציאה" }],
  },
];

// קבוצות להצגה לפי תפקיד. דייר רואה רק קבוצות שאינן של הוועד.
export function moreGroupsFor(isAdmin: boolean): MoreGroup[] {
  return MORE_GROUPS.filter((g) => (g.admin ? isAdmin : !isAdmin));
}
