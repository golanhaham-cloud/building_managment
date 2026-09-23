import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
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

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, status, estimated_cost, funded_so_far, target_date, description")
    .eq("building_id", appUser?.building_id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">תוכניות לעתיד</h1>

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
            </div>
          );
        })}
        {!projects?.length && <p className="text-gray-400 text-sm">אין תוכניות פעילות כרגע.</p>}
      </div>
    </div>
  );
}
