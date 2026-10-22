import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { changeUserRole } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inp } from "@/components/ui";

export default async function UsersPage() {
  const supabase = createClient();
  const me = await getCurrentAppUser();
  const { data: users } = await supabase.from("app_users").select("id, role, resident_id, created_at").eq("building_id", me?.building_id).order("created_at");
  const rids = (users ?? []).map((u: any) => u.resident_id).filter(Boolean);
  const { data: res } = rids.length ? await supabase.from("residents").select("id, full_name, apartment_id, apartments(apartment_number)").in("id", rids) : { data: [] as any[] };
  const byId = new Map((res ?? []).map((r: any) => [r.id, r]));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">הרשאות משתמשים</h1>
        <Link href="/manage" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">ניהול ←</Link>
      </div>
      <div className="card text-xs text-gray-600 space-y-1">
        <p>חבר ועד (admin) יכול לערוך נתוני בניין. דייר רגיל רק צופה ופותח פניות.</p>
        <p>שינוי תפקיד הוא פעולה מתועדת עם סיבה, אי אפשר להסיר את חבר הוועד האחרון, ואין שינוי תפקיד בשום דרך אחרת מהאפליקציה.</p>
      </div>
      <div className="card divide-y divide-gray-100">
        {(users ?? []).map((u: any) => {
          const r: any = byId.get(u.resident_id);
          const isMe = u.id === me?.id;
          return (
            <div key={u.id} className="py-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span><b>{r?.full_name ?? "משתמש ללא שיוך לדייר"}</b>{r?.apartments?.apartment_number ? ` · דירה ${r.apartments.apartment_number}` : ""}{isMe ? " (אני)" : ""}</span>
                <span className="text-xs">{u.role === "admin" ? "חבר ועד" : "דייר"}</span>
              </div>
              <ActionForm action={changeUserRole} className="flex flex-col gap-2">
                <input type="hidden" name="app_user_id" value={u.id} />
                <div className="flex gap-2">
                  <select name="role" defaultValue={u.role} className={inp}>
                    <option value="resident">דייר</option>
                    <option value="admin">חבר ועד</option>
                  </select>
                  <input name="reason" placeholder="סיבה (חובה)" className={inp} required minLength={3} />
                </div>
                <SubmitButton confirmText="לשנות את התפקיד של המשתמש? הפעולה נרשמת ביומן.">עדכן תפקיד</SubmitButton>
              </ActionForm>
            </div>
          );
        })}
      </div>
    </div>
  );
}
