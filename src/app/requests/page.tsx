import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { createRequest, updateRequestStatus } from "@/lib/actions";
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

export default async function RequestsPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";

  const { data: requests } = await supabase
    .from("requests")
    .select("id, title, description, status, created_at, apartments(apartment_number)")
    .eq("building_id", appUser?.building_id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">בקשות ותקלות</h1>

      <details className="card">
        <summary className="font-semibold cursor-pointer">+ פתיחת בקשה חדשה</summary>
        <form action={createRequest} className="space-y-2 mt-3">
          <input
            type="text"
            name="title"
            placeholder="כותרת (למשל: נורה שרופה בקומה 2)"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
          <input
            type="text"
            name="category"
            placeholder="קטגוריה (תחזוקה, ניקיון וכו')"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
          <textarea
            name="description"
            placeholder="תיאור מפורט"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            rows={2}
          />
          <button type="submit" className="btn-primary w-full text-sm py-1.5">
            פתח/י בקשה
          </button>
        </form>
      </details>

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

            {isAdmin && (
              <form action={updateRequestStatus} className="flex items-center gap-2 mt-2">
                <input type="hidden" name="request_id" value={r.id} />
                <select name="status" defaultValue={r.status} className="rounded-lg border border-gray-300 px-2 py-1 text-xs flex-1">
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button type="submit" className="text-xs bg-brand-600 text-white rounded-lg px-3 py-1.5">
                  עדכן/י
                </button>
              </form>
            )}
          </div>
        ))}
        {!requests?.length && <p className="text-gray-400 text-sm">אין בקשות פתוחות כרגע.</p>}
      </div>
    </div>
  );
}
