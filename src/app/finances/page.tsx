import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

function ils(n: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function FinancesPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, type, date, amount, description, categories(name), suppliers(name)")
    .eq("building_id", appUser?.building_id)
    .order("date", { ascending: false });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">כספי הבניין</h1>

      <div className="card divide-y divide-gray-100">
        {tx?.map((t: any) => (
          <div key={t.id} className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold">{t.description ?? t.categories?.name}</div>
              <div className="text-xs text-gray-400">
                {new Date(t.date).toLocaleDateString("he-IL")}
                {t.categories?.name ? ` · ${t.categories.name}` : ""}
                {t.suppliers?.name ? ` · ${t.suppliers.name}` : ""}
              </div>
            </div>
            <div
              className={`font-bold tabular-nums ${
                t.type === "income" ? "text-status-paid" : "text-status-unpaid"
              }`}
            >
              {t.type === "income" ? "+" : "-"}
              {ils(t.amount)}
            </div>
          </div>
        ))}
        {!tx?.length && <p className="text-gray-400 text-sm py-4">אין עדיין תנועות רשומות.</p>}
      </div>
    </div>
  );
}
