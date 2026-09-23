import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import type { RequestStatus } from "@/lib/types";

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "🔴 חדש",
  in_progress: "🟡 בטיפול",
  vendor_ordered: "🔵 הוזמן בעל מקצוע",
  awaiting_quote: "🟣 ממתין להצעת מחיר",
  resolved: "🟢 טופל",
  closed: "⚫ נסגר",
};

export default async function RequestsPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  const { data: requests } = await supabase
    .from("requests")
    .select("id, title, description, status, created_at, apartments(apartment_number)")
    .eq("building_id", appUser?.building_id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">בקשות ותקלות</h1>

      <div className="space-y-2">
        {requests?.map((r: any) => (
          <div key={r.id} className="card">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{r.title}</span>
              <span className="text-sm">{STATUS_LABELS[r.status as RequestStatus]}</span>
            </div>
            {r.description && <p className="text-sm text-gray-500 mt-1">{r.description}</p>}
            <div className="text-xs text-gray-400 mt-1">
              {r.apartments?.apartment_number ? `דירה ${r.apartments.apartment_number} · ` : ""}
              {new Date(r.created_at).toLocaleDateString("he-IL")}
            </div>
          </div>
        ))}
        {!requests?.length && <p className="text-gray-400 text-sm">אין בקשות פתוחות כרגע.</p>}
      </div>
    </div>
  );
}
