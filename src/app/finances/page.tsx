import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { addTransaction } from "@/lib/actions";
import Link from "next/link";

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
  const isAdmin = appUser?.role === "admin";

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, type, date, amount, description, categories(name), suppliers(name)")
    .eq("building_id", appUser?.building_id)
    .order("date", { ascending: false });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">כספי הבניין</h1>
        <Link href="/payments" className="text-sm text-brand-600 font-semibold">
          תשלומי ועד ←
        </Link>
      </div>

      {isAdmin && (
        <form action={addTransaction} className="card space-y-2">
          <div className="font-semibold text-sm">הוספת תנועה</div>
          <div className="grid grid-cols-2 gap-2">
            <select name="type" className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" required>
              <option value="expense">הוצאה</option>
              <option value="income">הכנסה</option>
            </select>
            <input
              type="date"
              name="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              required
            />
          </div>
          <input
            type="number"
            name="amount"
            step="0.01"
            placeholder="סכום בש״ח"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
          <input
            type="text"
            name="description"
            placeholder="תיאור (למשל: ניקיון חדר מדרגות)"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            required
          />
          <button type="submit" className="btn-primary w-full text-sm py-1.5">
            הוסף/י תנועה
          </button>
        </form>
      )}

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
