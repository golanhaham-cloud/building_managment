import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function ApartmentsPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  const { data: apartments } = await supabase
    .from("apartments")
    .select("id, floor, apartment_number, is_rented, owner_resident_id")
    .eq("building_id", appUser?.building_id)
    .order("floor", { ascending: false })
    .order("apartment_number");

  const { data: residents } = await supabase
    .from("residents")
    .select("id, apartment_id, full_name, ownership, is_primary_contact")
    .in("apartment_id", (apartments ?? []).map((a) => a.id));

  const byFloor = new Map<number, typeof apartments>();
  for (const apt of apartments ?? []) {
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
            <div className="font-bold text-brand-700 mb-2">קומה {floor}</div>
            <div className="divide-y divide-gray-100">
              {apts!.map((apt) => {
                const aptResidents = residents?.filter((r) => r.apartment_id === apt.id) ?? [];
                const owner = residents?.find((r) => r.id === apt.owner_resident_id);
                const primary = aptResidents.find((r) => r.is_primary_contact) ?? aptResidents[0];

                return (
                  <div key={apt.id} className="py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">דירה {apt.apartment_number}</span>
                      {apt.is_rented && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          בשכירות
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {primary ? primary.full_name : "לא הוזן דייר"}
                      {primary?.ownership === "tenant" && " (שוכר/ת)"}
                    </div>
                    {apt.is_rented && owner && (
                      <div className="text-xs text-gray-400">בעל/ת הדירה: {owner.full_name}</div>
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
