import Link from "next/link";

type L = { href: string; icon: string; title: string; desc: string };
type Group = { title: string; hint?: string; committee?: boolean; links: L[] };

const groups: Group[] = [
  {
    title: "כספים",
    links: [
      { href: "/manage/fees", icon: "🧾", title: "תעריפים, חיובים וזיכויים", desc: "תעריף ועד לפי חודש, חיוב חודשי, זיכויים" },
      { href: "/payments", icon: "💳", title: "תשלומי ועד", desc: "רישום תשלומים שהתקבלו" },
      { href: "/finances", icon: "💰", title: "הכנסות והוצאות", desc: "הוספה, תיקון וביטול עם סיבה" },
      { href: "/finances/import", icon: "🏦", title: "ייבוא מהבנק", desc: "ייבוא תנועות מקובץ" },
      { href: "/manage/suppliers", icon: "🧰", title: "ספקים", desc: "פרטי ספקים וחוזים" },
    ],
  },
  {
    title: "תפעול הבניין",
    links: [
      { href: "/manage/apartments", icon: "🏢", title: "דירות ודיירים", desc: "בעלים, שוכרים, מצב דירה, היסטוריה" },
      { href: "/requests", icon: "🔧", title: "פניות ותקלות", desc: "עדכון סטטוס וטיפול" },
      { href: "/projects", icon: "📋", title: "תוכניות", desc: "תכנון ומעקב" },
      { href: "/announcements", icon: "📢", title: "הודעות", desc: "פרסום ועריכה" },
    ],
  },
  {
    title: "פרטי לוועד 🔒",
    hint: "אזור פרטי: גלוי לחברי ועד בלבד. ההרשאה נאכפת במסד הנתונים, לא רק בתצוגה.",
    committee: true,
    links: [
      { href: "/manage/tasks", icon: "✅", title: "משימות ועד 🔒", desc: "אחראי, תאריך יעד, סטטוס והערות — פרטי לוועד" },
      { href: "/manage/documents", icon: "🗂️", title: "ארכיון מסמכי ועד 🔒", desc: "העלאה, פתיחה והורדה — פרטי לוועד" },
    ],
  },
  {
    title: "ניהול מערכת",
    links: [
      { href: "/manage/audit", icon: "📜", title: "יומן שינויים", desc: "מי שינה מה ומתי" },
      { href: "/manage/join-requests", icon: "🙋", title: "בקשות הצטרפות", desc: "אישור או דחייה של דיירים חדשים" },
      { href: "/manage/users", icon: "🔐", title: "הרשאות משתמשים", desc: "ניהול תפקידי ועד" },
      { href: "/account", icon: "👤", title: "החשבון שלי", desc: "סיסמה ויציאה" },
      { href: "/changelog", icon: "🆕", title: "גרסאות ושינויים", desc: "מה השתנה בכל גרסה של האתר" },
    ],
  },
];

export default function ManageHub() {
  return (
    <div className="p-4 space-y-5">
      <h1 className="text-xl font-extrabold">ניהול הבניין</h1>
      {groups.map((g) => (
        <section
          key={g.title}
          className={g.committee ? "rounded-2xl bg-amber-50/70 border border-amber-200 p-3 space-y-2" : "space-y-2"}
        >
          <h2 className="text-sm font-bold text-gray-600">{g.title}</h2>
          {g.hint && <p className="text-xs text-amber-800">{g.hint}</p>}
          {g.links.map((l) => (
            <Link key={l.href} href={l.href} className="card flex items-center gap-3">
              <span className="text-2xl">{l.icon}</span>
              <span>
                <span className="block font-semibold">{l.title}</span>
                <span className="block text-xs text-gray-500">{l.desc}</span>
              </span>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
