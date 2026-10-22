import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { removeCommitteeDocument } from "@/lib/file-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import CommitteeDocUpload from "@/components/CommitteeDocUpload";
import { fileIcon, fmtSize } from "@/lib/files";
import Link from "next/link";

export default async function DocumentsPage() {
  const supabase = createClient();
  const u = await getCurrentAppUser();
  const { data: docs } = await supabase
    .from("committee_documents")
    .select("id, title, doc_date, file_name, mime_type, size_bytes, created_at")
    .eq("building_id", u?.building_id)
    .is("removed_at", null)
    .order("doc_date", { ascending: false });

  return (
    <div className="p-4 space-y-4">
      <Link href="/manage" className="text-sm text-brand-600">→ ניהול הבניין</Link>
      <h1 className="text-xl font-extrabold">ארכיון מסמכי ועד 🔒</h1>
      <p className="text-xs text-gray-500">פרטי: גלוי לחברי ועד בלבד. ההרשאה נאכפת גם על הקבצים עצמם באחסון.</p>

      <details className="card">
        <summary className="font-semibold cursor-pointer">+ העלאת מסמך</summary>
        <CommitteeDocUpload buildingId={u?.building_id ?? ""} />
      </details>

      <div className="card divide-y divide-gray-100">
        {docs?.map((d: any) => (
          <div key={d.id} className="py-2 flex items-center gap-2 text-sm">
            <span className="text-xl">{fileIcon(d.mime_type)}</span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold truncate">{d.title}</span>
              <span className="block text-xs text-gray-400 truncate">
                {new Date(d.doc_date).toLocaleDateString("he-IL")} · {d.file_name} · {fmtSize(d.size_bytes)}
              </span>
            </span>
            <a href={`/files/doc/${d.id}`} target="_blank" rel="noopener" className="text-brand-600 text-xs">פתיחה</a>
            <a href={`/files/doc/${d.id}?dl=1`} className="text-brand-600 text-xs">הורדה</a>
            <ActionForm action={removeCommitteeDocument} className="inline">
              <input type="hidden" name="id" value={d.id} />
              <SubmitButton className="text-xs text-status-unpaid" confirmText="להסיר את המסמך מהארכיון? הפעולה נרשמת ביומן.">הסר</SubmitButton>
            </ActionForm>
          </div>
        ))}
        {!docs?.length && <p className="text-gray-400 text-sm py-2">אין מסמכים בארכיון.</p>}
      </div>
    </div>
  );
}
