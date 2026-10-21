import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { saveApartment } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inp, lbl } from "@/components/ui";
import { OCCUPANCY_LABELS } from "@/lib/errors";

export default async function ManageApartments() {
  const supabase = createClient();
  const u = await getCurrentAppUser();
  const { data: apts } = await supabase
    .from("apartments")
    .select("id, floor, apartment_number, rooms, apartment_type, occupancy_status")
    .eq("building_id", u?.building_id);
  const { data: people } = await supabase
    .from("residents")
    .select("apartment_id, full_name, ownership, lives_here")
    .eq("is_active", true);
  const sorted = [...(apts ?? [])].sort((a, b) => Number(a.apartment_number) - Number(b.apartment_number));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">דירות ודיירים</h1>
        <Link href="/manage" className="text-sm text-brand-600 font-semibold">ניהול ←</Link>
      </div>

      <details className="card">
        <summary className="font-semibold cursor-pointer text-sm">+ הוספת דירה</summary>
        <ActionForm action={saveApartment} className="space-y-2 mt-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className={lbl}>מספר דירה</label><input name="apartment_number" className={inp} required /></div>
            <div><label className={lbl}>קומה (0 = קרקע)</label><input name="floor" type="number" className={inp} required /></div>
            <div><label className={lbl}>סוג דירה</label><input name="apartment_type" placeholder="קרקע, פנטהאוז..." className={inp} /></div>
            <div><label className={lbl}>חדרים</label><input name="rooms" type="number" step="0.5" min="0" className={inp} /></div>
          </div>
          <div>
            <label className={lbl}>מצב הדירה</label>
            <select name="occupancy_status" className={inp} defaultValue="owner_occupied">
              {Object.entries(OCCUPANCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <SubmitButton>הוסף דירה</SubmitButton>
        </ActionForm>
      </details>

      <div className="card divide-y divide-gray-100">
        {sorted.map((a) => {
          const ppl = (people ?? []).filter((p: any) => p.apartment_id === a.id);
          return (
            <Link key={a.id} href={`/manage/apartments/${a.id}`} className="block py-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">דירה {a.apartment_number} <span className="text-xs text-gray-400">(קומה {a.floor})</span></span>
                <span className="text-xs text-gray-500">{OCCUPANCY_LABELS[a.occupancy_status]}</span>
              </div>
              <div className="text-xs text-gray-500">
                {[a.rooms ? `${a.rooms} חדרים` : "", a.apartment_type ?? ""].filter(Boolean).join(", ")}
              </div>
              <div className="text-sm text-gray-600">
                {ppl.length ? ppl.map((p: any) => `${p.full_name}${p.ownership === "owner" ? "" : " (שוכר/ת)"}${p.lives_here ? "" : " - לא מתגורר"}`).join(" · ") : "אין דיירים פעילים"}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
