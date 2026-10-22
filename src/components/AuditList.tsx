import { describeChanges, ENTITY_LABELS, type AuditEntry } from "@/lib/audit";

const ACTIONS: Record<string, string> = { insert: "נוצר", update: "עודכן", delete: "נמחק", import: "יובא" };

export default function AuditList({ entries, names, showEntity = true }: { entries: AuditEntry[]; names: Map<string, string>; showEntity?: boolean }) {
  if (!entries.length) return <p className="text-sm text-gray-500">אין עדיין רישומים.</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {entries.map((e) => {
        const changes = describeChanges(e);
        return (
          <li key={e.id} className="py-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">
                {showEntity ? `${ENTITY_LABELS[e.entity_type] ?? e.entity_type} · ` : ""}
                {ACTIONS[e.action_type] ?? e.action_type}
              </span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {new Date(e.created_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </div>
            <div className="text-xs text-gray-500">{e.user_id ? names.get(e.user_id) ?? "משתמש" : "המערכת"}</div>
            {e.reason && <div className="text-xs text-brand-700">סיבה: {e.reason}</div>}
            {changes.length > 0 && (
              <ul className="mt-1 text-xs text-gray-600 space-y-0.5">
                {changes.map((c, i) => (
                  <li key={i}>
                    {c.label}: {c.from ? <><s className="text-gray-500">{c.from}</s> ← </> : null}
                    <b>{c.to}</b>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
