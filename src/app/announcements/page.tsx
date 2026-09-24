import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { createAnnouncement } from "@/lib/actions";

export default async function AnnouncementsPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, is_important, created_at")
    .eq("building_id", appUser?.building_id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">הודעות ועד הבית</h1>

      {isAdmin && (
        <details className="card">
          <summary className="font-semibold cursor-pointer">+ הודעה חדשה</summary>
          <form action={createAnnouncement} className="space-y-2 mt-3">
            <input
              type="text"
              name="title"
              placeholder="כותרת ההודעה"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              required
            />
            <textarea
              name="body"
              placeholder="תוכן ההודעה"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              rows={3}
              required
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_important" /> סמן/י כהודעה חשובה
            </label>
            <button type="submit" className="btn-primary w-full text-sm py-1.5">
              פרסם/י הודעה
            </button>
          </form>
        </details>
      )}

      <div className="space-y-2">
        {announcements?.map((a) => (
          <div key={a.id} className={`card ${a.is_important ? "border-status-unpaid/40" : ""}`}>
            <div className="flex items-center gap-2">
              {a.is_important && <span>📌</span>}
              <span className="font-semibold">{a.title}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{a.body}</p>
            <div className="text-xs text-gray-400 mt-1">
              {new Date(a.created_at).toLocaleDateString("he-IL")}
            </div>
          </div>
        ))}
        {!announcements?.length && <p className="text-gray-400 text-sm">אין הודעות חדשות.</p>}
      </div>
    </div>
  );
}
