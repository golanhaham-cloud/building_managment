import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { saveRequest } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inp } from "@/components/ui";
import Link from "next/link";
import { DeleteButton } from "@/components/DeleteButton";
import { NewRequestForm } from "@/components/RequestFiles";
import { URGENCY_BADGE, URGENCY_LABELS, URGENCY_OPTIONS } from "@/lib/files";
import type { RequestStatus } from "@/lib/types";

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "🔴 חדש",
  in_progress: "🟡 בטיפול",
  vendor_ordered: "🔵 הוזמן בעל מקצוע",
  awaiting_quote: "🟣 ממתין להצעת מחיר",
  resolved: "🟢 טופל",
  closed: "⚫ נסגר",
};

const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as RequestStatus[];

export default async function RequestsPage({ searchParams }: { searchParams: { status?: string; urgency?: string } }) {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";

  const { data: requests } = await supabase
    .from("requests")
    .select("id, title, description, category, status, urgency, created_at, row_version, opened_by, apartments(apartment_number), request_attachments(id, removed_at)")
    .eq("building_id", appUser?.building_id)
    .order("created_at", { ascending: false });

  const fStatus = STATUS_OPTIONS.includes(searchParams.status as RequestStatus) ? (searchParams.status as RequestStatus) : "";
  const fUrg = searchParams.urgency === "none" || URGENCY_OPTIONS.includes(searchParams.urgency as any) ? (searchParams.urgency ?? "") : "";
  const all = requests ?? [];
  const shown = all.filter(
    (r: any) => (!fStatus || r.status === fStatus) && (!fUrg || (fUrg === "none" ? !r.urgency : r.urgency === fUrg)),
  );
  const filtered = !!(fStatus || fUrg);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">בקשות ותקלות</h1>

      <details className="card">
        <summary className="font-semibold cursor-pointer min-h-[44px] flex items-center">+ פתיחת בקשה חדשה</summary>
        <NewRequestForm buildingId={appUser?.building_id ?? ""} />
      </details>

      <form method="get" role="search" aria-label="סינון תקלות" className="card space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select name="status" defaultValue={fStatus} className={inp} aria-label="סינון לפי סטטוס">
            <option value="">כל הסטטוסים</option>
            {STATUS_OPTIONS.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
          </select>
          <select name="urgency" defaultValue={fUrg} className={inp} aria-label="סינון לפי דחיפות">
            <option value="">כל רמות הדחיפות</option>
            {URGENCY_OPTIONS.map((u) => <option key={u} value={u}>{URGENCY_LABELS[u]}</option>)}
            <option value="none">לא צוינה</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" className="btn-primary text-sm py-2.5 px-5 min-h-[44px]">סנן</button>
          {filtered && <Link href="/requests" className="text-sm text-brand-700 font-semibold min-h-[44px] inline-flex items-center">נקה סינון</Link>}
          <span className="text-xs text-gray-500 me-auto">מוצגות {shown.length} מתוך {all.length}</span>
        </div>
      </form>

      <div className="space-y-2">
        {shown.map((r: any) => (
          <div key={r.id} className="card">
            <div className="flex items-center justify-between">
              <Link href={`/requests/${r.id}`} className="font-semibold py-2 inline-block">{r.title}</Link>
              <span className="text-sm whitespace-nowrap">{STATUS_LABELS[r.status as RequestStatus]}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {r.urgency ? (
                <span className={`text-xs rounded-full px-2 py-0.5 ${URGENCY_BADGE[r.urgency]}`}>דחיפות: {URGENCY_LABELS[r.urgency]}</span>
              ) : (
                <span className="text-xs rounded-full px-2 py-0.5 bg-gray-100 text-gray-700">דחיפות: לא צוינה</span>
              )}
              {(() => {
                const n = (r.request_attachments ?? []).filter((x: any) => !x.removed_at).length;
                return n ? <span className="text-xs text-gray-500">📎 {n}</span> : null;
              })()}
              <Link href={`/requests/${r.id}`} className="text-sm text-brand-700 me-auto min-h-[44px] inline-flex items-center">לפרטים המלאים ולקבצים ›</Link>
            </div>
            {r.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{r.description}</p>}
            <div className="text-xs text-gray-500 mt-1">
              {r.apartments?.apartment_number ? `דירה ${r.apartments.apartment_number} · ` : ""}
              {new Date(r.created_at).toLocaleDateString("he-IL")}
            </div>

            {(isAdmin || r.opened_by === appUser?.id) && (
              <div className="mt-2">
                <DeleteButton kind="request" id={r.id} title={r.title} />
              </div>
            )}

            {isAdmin && (
              <details className="mt-2">
                <summary className="text-sm text-brand-700 cursor-pointer min-h-[44px] flex items-center">טיפול ועריכה</summary>
                <ActionForm action={saveRequest} keepOnSuccess className="space-y-2 mt-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="row_version" value={r.row_version} />
                  <input type="hidden" name="prev_status" value={r.status} />
                  <input name="title" aria-label="כותרת" defaultValue={r.title} className={inp} required />
                  <input name="category" aria-label="קטגוריה" defaultValue={r.category ?? ""} placeholder="קטגוריה" className={inp} />
                  <textarea name="description" aria-label="תיאור" defaultValue={r.description ?? ""} rows={2} className={inp} />
                  <select name="urgency" aria-label="דחיפות" defaultValue={r.urgency ?? ""} className={inp}>
                    <option value="">דחיפות: לא צוינה</option>
                    {URGENCY_OPTIONS.map((u) => <option key={u} value={u}>דחיפות: {URGENCY_LABELS[u]}</option>)}
                  </select>
                  <select name="status" aria-label="סטטוס" defaultValue={r.status} className={inp}>
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>{STATUS_LABELS[st]}</option>
                    ))}
                  </select>
                  <input name="comment" aria-label="הערת טיפול" placeholder="הערת טיפול (נשמרת בהיסטוריית הפנייה)" className={inp} />
                  <SubmitButton>שמור</SubmitButton>
                </ActionForm>
              </details>
            )}
          </div>
        ))}
        {!shown.length && (
          <p className="text-gray-500 text-sm">
            {filtered ? "אין תקלות התואמות את הסינון." : "אין בקשות פתוחות כרגע."}
          </p>
        )}
      </div>
    </div>
  );
}
