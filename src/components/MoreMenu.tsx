import Link from "next/link";
import { moreGroupsFor } from "@/lib/nav";

// תצוגת "עוד": קבוצות קישורים. ההסתרה היא תצוגה בלבד; ההרשאות נאכפות בשרת ובמסד בכל עמוד ופעולה.
export default function MoreMenu({ isAdmin, title }: { isAdmin: boolean; title: string }) {
  return (
    <div className="p-4 space-y-5">
      <h1 className="text-xl font-extrabold">{title}</h1>
      {moreGroupsFor(isAdmin).map((g) => (
        <section key={g.id} data-group={g.id} className={g.committee ? "rounded-2xl bg-amber-50/70 border border-amber-200 p-3 space-y-2" : "space-y-2"}>
          <h2 className="text-sm font-bold text-gray-600">{g.title}</h2>
          {g.hint && <p className="text-xs text-amber-800">{g.hint}</p>}
          {g.items.map((l) => (
            <Link key={l.href} href={l.href} className="card flex items-center gap-3 min-h-[44px]">
              <span className="text-2xl">{l.icon}</span>
              <span className="min-w-0">
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
