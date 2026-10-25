import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { approveJoinRequest, rejectJoinRequest } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inp, lbl, btnDanger } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pending: "ממתינה", approved: "אושרה", rejected: "נדחתה" };

export default async function JoinRequestsPage() {
  const supabase = createClient();
  const u = await getCurrentAppUser();
  const [{ data: reqs }, { data: apts }, { data: people }, { data: linked }] = await Promise.all([
    supabase.from("join_requests").select("id, email, status, requested_at, decided_at, reject_reason, resident_id, apartment_id").eq("building_id", u?.building_id).order("requested_at", { ascending: false }),
    supabase.from("apartments").select("id, floor, apartment_number").eq("building_id", u?.building_id),
    supabase.from("residents").select("id, full_name, email, apartment_id, ownership").eq("is_active", true),
    supabase.from("app_users").select("resident_id").eq("building_id", u?.building_id),
  ]);
  const sortedApts = [...(apts ?? [])].sort((a: any, b: any) => a.floor - b.floor || Number(a.apartment_number) - Number(b.apartment_number));
  const aptLabel = (id: string) => {
    const a: any = (apts ?? []).find((x: any) => x.id === id);
    return a ? `דירה ${a.apartment_number} (קומה ${a.floor})` : "";
  };
  const linkedIds = new Set((linked ?? []).map((l: any) => l.resident_id).filter(Boolean));
  const unlinked = (people ?? []).filter((p: any) => !linkedIds.has(p.id));
  const pending = (reqs ?? []).filter((r: any) => r.status === "pending");
  const decided = (reqs ?? []).filter((r: any) => r.status !== "pending");

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">בקשות הצטרפות</h1>
        <Link href="/manage" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">ניהול ←</Link>
      </div>
      <div className="card text-xs text-gray-600 space-y-1">
        <p>כאן מופיעים אנשים שנרשמו עם מייל שלא ברשימת הדיירים והזינו קוד בניין תקין. עד האישור אין להם גישה לנתוני הבניין.</p>
        <p>באישור תבחר/י דירה, תזין/י או תאשר/י שם מלא, בעלים/שוכר והאם מתגורר בדירה. המשתמש מקבל תפקיד דייר בלבד. קידום לחבר ועד נעשה בנפרד במסך ההרשאות.</p>
      </div>

      <h2 className="font-bold">ממתינות לאישור ({pending.length})</h2>
      {pending.length === 0 && <div className="card text-sm text-gray-600">אין בקשות ממתינות.</div>}
      {pending.map((r: any) => {
        const sameEmail = unlinked.filter((p: any) => p.email && p.email.trim().toLowerCase() === r.email.toLowerCase());
        return (
          <div key={r.id} className="card space-y-3">
            <div>
              <div dir="ltr" className="font-semibold break-all text-right">{r.email}</div>
              <div className="text-xs text-gray-600">נשלחה: {new Date(r.requested_at).toLocaleString("he-IL")}</div>
            </div>
            {sameEmail.length > 0 && (
              <p className="text-xs text-orange-700">נמצא דייר לא משויך עם אותו מייל: {sameEmail.map((p: any) => p.full_name).join(", ")}. מומלץ לקשר אותו במקום ליצור חדש.</p>
            )}
            <ActionForm action={approveJoinRequest} className="space-y-2">
              <input type="hidden" name="request_id" value={r.id} />
              <div>
                <label className={lbl}>דירה</label>
                <select name="apartment_id" className={inp} required defaultValue="">
                  <option value="" disabled>בחר/י דירה</option>
                  {sortedApts.map((a: any) => <option key={a.id} value={a.id}>קומה {a.floor} · דירה {a.apartment_number}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>קישור לדייר קיים (לא חובה, פרטיו לא ישתנו)</label>
                <select name="link_resident_id" className={inp} defaultValue="">
                  <option value="">ליצור דייר חדש</option>
                  {unlinked.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} · {aptLabel(p.apartment_id)}{p.email && p.email.trim().toLowerCase() === r.email.toLowerCase() ? " · אותו מייל" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-0.5">בקישור, הדירה חייבת להיות דירת הדייר הקיים.</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2 space-y-2">
                <p className="text-xs text-gray-600">פרטי דייר חדש (נדרשים רק כשיוצרים דייר חדש):</p>
                <div><label className={lbl}>שם מלא</label><input name="full_name" className={inp} autoComplete="off" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={lbl}>בעלים / שוכר</label>
                    <select name="ownership" className={inp} defaultValue="">
                      <option value="" disabled>בחר/י</option>
                      <option value="owner">בעלים</option>
                      <option value="tenant">שוכר</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>מתגורר בדירה?</label>
                    <select name="lives_here" className={inp} defaultValue="">
                      <option value="" disabled>בחר/י</option>
                      <option value="yes">כן</option>
                      <option value="no">לא</option>
                    </select>
                  </div>
                </div>
              </div>
              <SubmitButton pendingText="מאשר...">אישור ושיוך לדירה</SubmitButton>
            </ActionForm>
            <details>
              <summary className="cursor-pointer text-sm text-red-700 min-h-[44px] flex items-center">דחיית הבקשה</summary>
              <ActionForm action={rejectJoinRequest} className="space-y-2 mt-2">
                <input type="hidden" name="request_id" value={r.id} />
                <div><label className={lbl}>סיבת הדחייה (נרשמת ביומן, לא מוצגת למבקש)</label><input name="reason" className={inp} required minLength={3} /></div>
                <SubmitButton className={btnDanger} pendingText="דוחה..." confirmText="לדחות את הבקשה?">דחייה</SubmitButton>
              </ActionForm>
            </details>
          </div>
        );
      })}

      {decided.length > 0 && (
        <>
          <h2 className="font-bold">טופלו</h2>
          <div className="card divide-y divide-gray-100">
            {decided.map((r: any) => (
              <div key={r.id} className="py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span dir="ltr" className="break-all">{r.email}</span>
                  <span className={r.status === "approved" ? "text-green-700" : "text-red-700"}>{STATUS[r.status]}</span>
                </div>
                <div className="text-xs text-gray-600">
                  {r.decided_at ? new Date(r.decided_at).toLocaleString("he-IL") : ""}
                  {r.status === "approved" && r.apartment_id ? ` · ${aptLabel(r.apartment_id)}` : ""}
                  {r.status === "rejected" && r.reject_reason ? ` · סיבה: ${r.reject_reason}` : ""}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
