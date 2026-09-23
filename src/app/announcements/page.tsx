import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function AnnouncementsPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, is_important, created_at")
    .eq("building_id", appUser?.building_id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">הודעות ועד הבית</h1>

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
