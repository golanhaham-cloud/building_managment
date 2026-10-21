import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { createProject } from "@/lib/actions";
import { saveProject } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inp, lbl } from "@/components/ui";
import type { ProjectStatus } from "@/lib/types";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: "רעיון",
  costing: "בדיקת עלויות",
  quotes: "קבלת הצעות מחיר",
  vote: "הצבעה",
  approved: "אושר",
  ordered: "הוזמנה עבודה",
  in_progress: "בביצוע",
  done: "הושלם",
};

function ils(n: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function ProjectsPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, status, estimated_cost, funded_so_far, target_date, description, row_version")
    .eq("building_id", appUser?.building_id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">תוכניות לעתיד</h1>

      {isAdmin && (
        <details className="card">
          <summary className="font-semibold cursor-pointer">+ תוכנית חדשה</summary>
          <form action={createProject} className="space-y-2 mt-3">
            <input
              type="text"
              name="title"
              placeholder="שם הפרויקט"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              required
            />
            <textarea
              name="description"
              placeholder="תיאור"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              rows={2}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                name="estimated_cost"
                placeholder="עלות משוערת"
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input type="date" name="target_date" className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
            </div>
            <button type="submit" className="btn-primary w-full text-sm py-1.5">
              הוסף/י תוכנית
            </button>
          </form>
        </details>
      )}

      <div className="space-y-3">
        {projects?.map((p) => {
          const remaining = Math.max((p.estimated_cost ?? 0) - (p.funded_so_far ?? 0), 0);
          return (
            <div key={p.id} className="card">
              <div className="font-semibold">{p.title}</div>
              <div className="text-sm text-brand-600">{STATUS_LABELS[p.status as ProjectStatus]}</div>
              {p.description && <p className="text-sm text-gray-500 mt-1">{p.description}</p>}
              <div className="mt-2 text-sm space-y-0.5">
                <div>עלות משוערת: {ils(p.estimated_cost ?? 0)}</div>
                <div>כבר נצבר בקופה: {ils(p.funded_so_far ?? 0)}</div>
                <div>נותר לגייס: {ils(remaining)}</div>
                {p.target_date && (
                  <div>צפי ביצוע: {new Date(p.target_date).toLocaleDateString("he-IL")}</div>
                )}
              </div>
              {isAdmin && (
                <details className="mt-2">
                  <summary className="text-xs text-brand-600 cursor-pointer">עריכה</summary>
                  <ActionForm action={saveProject} keepOnSuccess className="space-y-2 mt-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="row_version" value={p.row_version} />
                    <input name="title" defaultValue={p.title} className={inp} required />
                    <textarea name="description" defaultValue={p.description ?? ""} rows={2} className={inp} />
                    <select name="status" defaultValue={p.status} className={inp}>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={lbl}>עלות משוערת</label><input name="estimated_cost" type="number" step="0.01" min="0" defaultValue={p.estimated_cost ?? ""} className={inp} /></div>
                      <div><label className={lbl}>נצבר עד כה</label><input name="funded_so_far" type="number" step="0.01" min="0" defaultValue={p.funded_so_far ?? 0} className={inp} /></div>
                    </div>
                    <div><label className={lbl}>תאריך יעד</label><input name="target_date" type="date" defaultValue={p.target_date ?? ""} className={inp} /></div>
                    <SubmitButton>שמור שינויים</SubmitButton>
                  </ActionForm>
                </details>
              )}
            </div>
          );
        })}
        {!projects?.length && <p className="text-gray-400 text-sm">אין תוכניות פעילות כרגע.</p>}
      </div>
    </div>
  );
}
