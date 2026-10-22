import Link from "next/link";

const links = [
  { href: "/manage/apartments", icon: "🏢", title: "דירות ודיירים", desc: "בעלים, שוכרים, מצב דירה, היסטוריה" },
  { href: "/manage/fees", icon: "🧾", title: "תעריפים, חיובים וזיכויים", desc: "תעריף ועד לפי חודש, חיוב חודשי, זיכויים" },
  { href: "/payments", icon: "💳", title: "תשלומי ועד", desc: "רישום תשלומים שהתקבלו" },
  { href: "/finances", icon: "💰", title: "הכנסות והוצאות", desc: "הוספה, תיקון וביטול עם סיבה" },
  { href: "/manage/tasks", icon: "✅", title: "משימות ועד 🔒", desc: "אחראי, תאריך יעד, סטטוס והערות — פרטי לוועד" },
  { href: "/manage/documents", icon: "🗂️", title: "ארכיון מסמכי ועד 🔒", desc: "העלאה, פתיחה והורדה — פרטי לוועד" },
  { href: "/manage/suppliers", icon: "🧰", title: "ספקים", desc: "פרטי ספקים וחוזים" },
  { href: "/requests", icon: "🔧", title: "פניות ותקלות", desc: "עדכון סטטוס וטיפול" },
  { href: "/projects", icon: "📋", title: "תוכניות", desc: "תכנון ומעקב" },
  { href: "/announcements", icon: "📢", title: "הודעות", desc: "פרסום ועריכה" },
  { href: "/manage/audit", icon: "📜", title: "יומן שינויים", desc: "מי שינה מה ומתי" },
  { href: "/manage/users", icon: "🔐", title: "הרשאות משתמשים", desc: "ניהול תפקידי ועד" },
  { href: "/account", icon: "👤", title: "החשבון שלי", desc: "סיסמה ויציאה" },
];

export default function ManageHub() {
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-extrabold">ניהול הבניין</h1>
      <div className="space-y-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card flex items-center gap-3">
            <span className="text-2xl">{l.icon}</span>
            <span>
              <span className="block font-semibold">{l.title}</span>
              <span className="block text-xs text-gray-500">{l.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
