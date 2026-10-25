import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { removeRequestAttachment } from "@/lib/file-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AttachFilesForm } from "@/components/RequestFiles";
import { DeleteButton } from "@/components/DeleteButton";
import { URGENCY_BADGE, URGENCY_LABELS, fileIcon, fmtSize, MAX_FILES_PER_REQUEST } from "@/lib/files";

const STATUS_LABELS: Record<string, string> = {
  new: "🔴 חדש", in_progress: "🟡 בטיפול", vendor_ordered: "🔵 הוזמן בעל מקצוע",
  awaiting_quote: "🟣 ממתין להצעת מחיר", resolved: "🟢 טופל", closed: "⚫ נסגר",
};

export default async function RequestDetail({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";

  const { data: r } = await supabase
    .from("requests")
    .select("id, title, description, category, status, urgency, created_at, opened_by, apartments(apartment_number)")
    .eq("id", params.id)
    .eq("building_id", appUser?.building_id)
    .maybeSingle();
  if (!r) notFound();

  const { data: files } = await supabase
    .from("request_attachments")
    .select("id, file_name, mime_type, size_bytes, uploaded_by, created_at")
    .eq("request_id", r.id)
    .is("removed_at", null)
    .order("created_at");
  const { data: updates } = await supabase
    .from("request_updates")
    .select("id, status, comment, created_at")
    .eq("request_id", r.id)
    .order("created_at", { ascending: false });

  const canAttach = isAdmin || r.opened_by === appUser?.id;
  const full = (files?.length ?? 0) >= MAX_FILES_PER_REQUEST;

  return (
    <div className="p-4 space-y-4">
      <Link href="/requests" className="inline-flex items-center min-h-[44px] text-sm text-brand-700">→ חזרה לפניות</Link>
      <div className="card space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-extrabold">{r.title}</h1>
          <span className="text-sm whitespace-nowrap">{STATUS_LABELS[r.status]}</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {r.urgency ? (
            <span className={`text-xs rounded-full px-2 py-0.5 ${URGENCY_BADGE[r.urgency]}`}>דחיפות: {URGENCY_LABELS[r.urgency]}</span>
          ) : (
            <span className="text-xs rounded-full px-2 py-0.5 bg-gray-100 text-gray-700">דחיפות: לא צוינה</span>
          )}
          {r.category && <span className="text-xs text-gray-500">{r.category}</span>}
        </div>
        {r.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.description}</p>}
        {(isAdmin || r.opened_by === appUser?.id) && (
          <div><DeleteButton kind="request" id={r.id} title={r.title} redirectTo="/requests" /></div>
        )}
        <div className="text-xs text-gray-500">
          {(r.apartments as any)?.apartment_number ? `דירה ${(r.apartments as any).apartment_number} · ` : ""}
          {new Date(r.created_at).toLocaleDateString("he-IL")}
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold">קבצים מצורפים</h2>
        {!files?.length && <p className="text-sm text-gray-500">אין קבצים מצורפים.</p>}
        <ul className="divide-y divide-gray-100">
          {files?.map((f: any) => {
            const canRemove = isAdmin || f.uploaded_by === appUser?.id;
            return (
              <li key={f.id} className="py-2 flex items-center gap-2 text-sm">
                <span>{fileIcon(f.mime_type)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{f.file_name}</span>
                  <span className="text-xs text-gray-500">{fmtSize(f.size_bytes)}</span>
                </span>
                <a href={`/files/request/${f.id}`} target="_blank" rel="noopener" className="text-brand-700 text-sm inline-flex items-center min-h-[44px] px-2">פתיחה</a>
                <a href={`/files/request/${f.id}?dl=1`} className="text-brand-700 text-sm inline-flex items-center min-h-[44px] px-2">הורדה</a>
                {canRemove && (
                  <ActionForm action={removeRequestAttachment} className="inline">
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="request_id" value={r.id} />
                    <SubmitButton className="text-xs text-red-700" confirmText="להסיר את הקובץ מהפנייה?">הסר</SubmitButton>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
        {canAttach ? (
          full ? (
            <p className="text-sm text-gray-500">הגעת למקסימום של {MAX_FILES_PER_REQUEST} קבצים לפנייה.</p>
          ) : (
            <AttachFilesForm buildingId={appUser?.building_id ?? ""} requestId={r.id} />
          )
        ) : (
          <p className="text-xs text-gray-500">צירוף קבצים אפשרי לפותח/ת הפנייה ולוועד.</p>
        )}
      </div>

      {!!updates?.length && (
        <div className="card">
          <h2 className="font-semibold mb-1">היסטוריית טיפול</h2>
          <ul className="text-sm divide-y divide-gray-100">
            {updates.map((u: any) => (
              <li key={u.id} className="py-1.5">
                {STATUS_LABELS[u.status]} {u.comment && <span className="text-gray-600">· {u.comment}</span>}
                <span className="block text-xs text-gray-500">{new Date(u.created_at).toLocaleString("he-IL")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
