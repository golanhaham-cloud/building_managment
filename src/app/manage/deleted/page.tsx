import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RestoreButton } from "@/components/DeleteButton";
import { URGENCY_LABELS } from "@/lib/files";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  new: "חדש", in_progress: "בטיפול", vendor_ordered: "הוזמן בעל מקצוע",
  awaiting_quote: "ממתין להצעת מחיר", resolved: "טופל", closed: "נסגר",
};

type Item = {
  kind: "announcement" | "request"; id: string; title: string; body: string | null; status: string | null; urgency: string | null;
  is_important: boolean | null; created_at: string; deleted_at: string; deleted_by_name: string | null; attachments: number;
};

// Committee only: the layout redirects non-committee users, and list_deleted_items() re-checks admin in the database.
export default async function DeletedPage() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_deleted_items");
  const items = (data ?? []) as Item[];
  const groups: { kind: Item["kind"]; label: string }[] = [
    { kind: "announcement", label: "הודעות שנמחקו" },
    { kind: "request", label: "תקלות ופניות שנמחקו" },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">נמחקו 🔒</h1>
        <Link href="/manage" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">ניהול ←</Link>
      </div>
      <div className="card text-xs text-gray-600">
        פריטים שנמחקו מוסתרים מכל הרשימות והתצוגות. כאן אפשר לשחזר אותם עם התוכן, הקבצים והסטטוס שהיו להם. כל מחיקה ושחזור נרשמים ביומן השינויים.
      </div>
      {error && <p className="text-sm text-red-700" role="alert">לא ניתן לטעון את הרשימה: {error.message.replace(/^[A-Z_]{4,}:\s*/, "")}</p>}
      {groups.map((g) => {
        const rows = items.filter((i) => i.kind === g.kind);
        return (
          <section key={g.kind} className="space-y-2">
            <h2 className="font-bold">{g.label} ({rows.length})</h2>
            {rows.length === 0 && <div className="card text-sm text-gray-600">אין פריטים.</div>}
            {rows.map((i) => (
              <div key={i.id} className="card space-y-2">
                <div className="font-semibold break-words">{i.title}</div>
                {i.body && <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">{i.body}</p>}
                <div className="text-xs text-gray-600 space-y-0.5">
                  {i.kind === "request" && (
                    <div>
                      סטטוס: {STATUS_LABELS[i.status ?? ""] ?? i.status}
                      {i.urgency ? ` · דחיפות: ${URGENCY_LABELS[i.urgency] ?? i.urgency}` : ""}
                      {i.attachments > 0 ? ` · 📎 ${i.attachments} קבצים` : ""}
                    </div>
                  )}
                  <div>נוצר: {new Date(i.created_at).toLocaleDateString("he-IL")}</div>
                  <div>נמחק: {new Date(i.deleted_at).toLocaleString("he-IL")}{i.deleted_by_name ? ` · על ידי ${i.deleted_by_name}` : ""}</div>
                </div>
                <RestoreButton kind={i.kind} id={i.id} />
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
