import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { INLINE_TYPES } from "@/lib/files";

export const dynamic = "force-dynamic";

// Authenticated file gateway. Authorization is decided by the database (RLS on the metadata row
// and storage policies on the object), using the caller's own session - never a service key.
export async function GET(req: NextRequest, { params }: { params: { kind: string; id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("יש להתחבר", { status: 401 });

  const cfg =
    params.kind === "request"
      ? { table: "request_attachments", bucket: "request-files" }
      : params.kind === "doc"
        ? { table: "committee_documents", bucket: "committee-docs" }
        : null;
  if (!cfg || !/^[0-9a-f-]{36}$/i.test(params.id)) return new NextResponse("לא נמצא", { status: 404 });

  const { data: row } = await supabase
    .from(cfg.table)
    .select("storage_path, file_name, mime_type, removed_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!row || row.removed_at) return new NextResponse("לא נמצא", { status: 404 });

  const wantDownload = req.nextUrl.searchParams.get("dl") === "1" || !INLINE_TYPES.has(row.mime_type);
  const { data, error } = await supabase.storage
    .from(cfg.bucket)
    .createSignedUrl(row.storage_path, 60, wantDownload ? { download: row.file_name } : undefined);
  if (error || !data?.signedUrl) return new NextResponse("אין הרשאה או שהקובץ אינו זמין", { status: 403 });

  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
