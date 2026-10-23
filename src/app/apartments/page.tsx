import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { OCCUPANCY_LABELS } from "@/lib/errors";
import ResidentContacts from "@/components/ResidentContacts";

export default async function ApartmentsPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  const { data: apartments } = await supabase
    .from("apartments")
    .select("id, floor, apartment_number, occupancy_status, owner_resident_id, rooms, apartment_type, occupants_count")
    .eq("building_id", appUser?.building_id);

  const { data: people } = await supabase.rpc("get_resident_directory");
  const residents = (people ?? []) as any[];

  const sorted = [...(apartments ?? [])].sort((a, b) => Number(a.apartment_number) - Number(b.apartment_number));
  const byFloor = new Map<number, typeof sorted>();
  for (const apt of sorted) {
    if (!byFloor.has(apt.floor)) byFloor.set(apt.floor, []);
    byFloor.get(apt.floor)!.push(apt);
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">דיירי הבניין - לפי קומה</h1>

      {[...byFloor.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([floor, apts]) => (
          <div key={floor} className="card">
            <div className="font-bold text-brand-700 mb-2">{floor === 0 ? "קומת קרקע" : `קומה ${floor}`}</div>
            <div className="divide-y divide-gray-100">
              {apts.map((apt) => {
                const aptPeople = residents.filter((r) => r.apartment_id === apt.id);
                const living = aptPeople.filter((r) => r.lives_here);
                const owners = aptPeople.filter((r) => r.ownership === "owner");
                const primary = living.find((r) => r.is_primary_contact) ?? living[0];
                const rented = apt.occupancy_status === "rented";
                return (
                  <div key={apt.id} className="py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        דירה {apt.apartment_number}
                        {(apt.rooms || apt.apartment_type) && (
                          <span className="text-xs font-normal text-gray-500">
                            {" · "}
                            {apt.rooms ? `${apt.rooms} חדרים` : ""}
                            {apt.rooms && apt.apartment_type ? ", " : ""}
                            {apt.apartment_type ?? ""}
                          </span>
                        )}
                      </span>
                      <span className="flex gap-1">
                        {primary?.is_committee && <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">ועד</span>}
                        {apt.occupancy_status !== "owner_occupied" && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${rented ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                            {rented ? "בשכירות" : OCCUPANCY_LABELS[apt.occupancy_status]}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {living.length ? (
                        <ResidentContacts people={living.map((r) => ({ id: r.id, name: r.full_name, suffix: r.ownership === "tenant" ? " (שוכר/ת)" : "" }))} />
                      ) : apt.occupancy_status === "vacant" ? (
                        "הדירה ריקה"
                      ) : (
                        "לא הוזן דייר"
                      )}
                      {apt.occupants_count ? ` · ${apt.occupants_count} נפשות` : ""}
                    </div>
                    {rented && owners.filter((o) => !o.lives_here).length > 0 && (
                      <div className="text-xs text-gray-500">
                        בעל/ת הדירה: <ResidentContacts people={owners.filter((o) => !o.lives_here).map((o) => ({ id: o.id, name: o.full_name }))} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
