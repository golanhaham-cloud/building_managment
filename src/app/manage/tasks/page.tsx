import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { saveTask } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inp, lbl } from "@/components/ui";
import Link from "next/link";

const STATUS: Record<string, string> = { open: "🔴 פתוחה", in_progress: "🟡 בטיפול", done: "🟢 הושלמה", cancelled: "⚫ בוטלה" };
const ORDER: Record<string, number> = { open: 0, in_progress: 1, done: 2, cancelled: 3 };

function Fields({ t, members }: { t?: any; members: string[] }) {
  return (
    <>
      {t && <input type="hidden" name="id" value={t.id} />}
      {t && <input type="hidden" name="row_version" value={t.row_version} />}
      <div><label className={lbl}>כותרת</label><input name="title" aria-label="כותרת" defaultValue={t?.title ?? ""} className={inp} required /></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>אחראי/ת</label>
          <input name="assignee" aria-label="אחראי/ת" list="task-members" defaultValue={t?.assignee ?? ""} className={inp} />
          <datalist id="task-members">{members.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
        <div><label className={lbl}>תאריך יעד</label><input type="date" aria-label="תאריך יעד" name="due_date" defaultValue={t?.due_date ?? ""} className={inp} /></div>
      </div>
      <div>
        <label className={lbl}>סטטוס</label>
        <select name="status" aria-label="סטטוס" defaultValue={t?.status ?? "open"} className={inp}>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div><label className={lbl}>הערות</label><textarea name="notes" aria-label="הערות" defaultValue={t?.notes ?? ""} rows={2} className={inp} /></div>
    </>
  );
}

export default async function TasksPage() {
  const supabase = createClient();
  const u = await getCurrentAppUser();
  const { data: tasks } = await supabase
    .from("committee_tasks")
    .select("id, title, assignee, due_date, status, notes, row_version")
    .eq("building_id", u?.building_id);
  const { data: admins } = await supabase.from("app_users").select("resident_id").eq("role", "admin").eq("building_id", u?.building_id);
  const ids = (admins ?? []).map((a: any) => a.resident_id).filter(Boolean);
  const { data: res } = ids.length ? await supabase.from("residents").select("full_name").in("id", ids) : { data: [] as any[] };
  const members = (res ?? []).map((r: any) => r.full_name);

  const sorted = [...(tasks ?? [])].sort(
    (a: any, b: any) => ORDER[a.status] - ORDER[b.status] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 space-y-4">
      <Link href="/manage" className="text-sm text-brand-700 inline-flex items-center min-h-[44px]">→ ניהול הבניין</Link>
      <h1 className="text-xl font-extrabold">משימות ועד 🔒</h1>
      <p className="text-xs text-gray-500">אזור פרטי: גלוי לחברי ועד בלבד, והגישה נאכפת במסד הנתונים.</p>

      <details className="card">
        <summary className="font-semibold cursor-pointer">+ משימה חדשה</summary>
        <ActionForm action={saveTask} className="space-y-2 mt-3">
          <Fields members={members} />
          <SubmitButton>הוסף משימה</SubmitButton>
        </ActionForm>
      </details>

      <div className="space-y-2">
        {sorted.map((t: any) => {
          const overdue = t.due_date && t.due_date < today && (t.status === "open" || t.status === "in_progress");
          return (
            <div key={t.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{t.title}</span>
                <span className="text-sm whitespace-nowrap">{STATUS[t.status]}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t.assignee ? `אחראי/ת: ${t.assignee}` : "ללא אחראי"}
                {t.due_date && <span className={overdue ? "text-orange-700 font-semibold" : ""}> · יעד {new Date(t.due_date).toLocaleDateString("he-IL")}{overdue ? " (עבר)" : ""}</span>}
              </div>
              {t.notes && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{t.notes}</p>}
              <details className="mt-2">
                <summary className="text-xs text-brand-600 cursor-pointer">עריכה</summary>
                <ActionForm action={saveTask} keepOnSuccess className="space-y-2 mt-2">
                  <Fields t={t} members={members} />
                  <SubmitButton>שמור</SubmitButton>
                </ActionForm>
              </details>
            </div>
          );
        })}
        {!sorted.length && <p className="text-gray-500 text-sm">אין משימות עדיין.</p>}
      </div>
    </div>
  );
}
