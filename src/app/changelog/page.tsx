import { APP_VERSION, CHANGELOG } from "@/lib/version";

export const metadata = { title: "גרסאות ושינויים" };

export default function ChangelogPage() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">גרסאות ושינויים</h1>
      <p className="text-sm text-gray-700">
        הגרסה הנוכחית: <b dir="ltr" className="tabular-nums">{APP_VERSION}</b>
      </p>
      {CHANGELOG.map((c) => (
        <section key={c.version} className="card space-y-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span dir="ltr" className="font-extrabold tabular-nums">{c.version}</span>
            <span className="text-xs text-gray-600" dir="ltr">{c.date}</span>
            {c.version === APP_VERSION && <span className="text-xs rounded-full bg-brand-50 text-brand-700 px-2 py-0.5">נוכחית</span>}
          </div>
          <h2 className="font-semibold">{c.title}</h2>
          <ul className="list-disc pr-5 text-sm space-y-1">
            {c.changes.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
          {c.note && <p className="text-xs text-gray-600">{c.note}</p>}
        </section>
      ))}
    </div>
  );
}
