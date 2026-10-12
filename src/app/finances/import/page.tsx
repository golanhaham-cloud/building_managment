import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import ImportClient from "./ImportClient";

export default async function ImportPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/finances");

  const supabase = createClient();
  const { data: apartments } = await supabase
    .from("apartments")
    .select("id, apartment_number, monthly_fee")
    .eq("building_id", appUser.building_id);

  const { data: residents } = await supabase
    .from("residents")
    .select("apartment_id, full_name")
    .in("apartment_id", (apartments ?? []).map((a) => a.id));

  const apts = (apartments ?? [])
    .map((a) => ({
      id: a.id,
      number: a.apartment_number as string,
      names: (residents ?? []).filter((r) => r.apartment_id === a.id).map((r) => r.full_name as string),
    }))
    .sort((a, b) => Number(a.number) - Number(b.number));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">ייבוא תנועות מהבנק</h1>
        <Link href="/finances" className="text-sm text-brand-600 font-semibold">
          חזרה ←
        </Link>
      </div>
      <ImportClient apartments={apts} />
    </div>
  );
}
