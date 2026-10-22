import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import AuditList from "@/components/AuditList";
import { ENTITY_LABELS, userNameMap, type AuditEntry } from "@/lib/audit";
import { inp } from "@/components/ui";

export default async function AuditPage({ searchParams }: { searchParams: { entity?: string } }) {
  const supabase = createClient();
  const u = await getCurrentAppUser();
  let q = supabase.from("audit_log").select("*").eq("building_id", u?.building_id).order("created_at", { ascending: false }).limit(200);
  if (searchParams.entity) q = q.eq("entity_type", searchParams.entity);
  const { data } = await q;
  const names = await userNameMap(supabase, (data ?? []).map((d: any) => d.user_id));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">יומן שינויים</h1>
        <Link href="/manage" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">ניהול ←</Link>
      </div>
      <form className="card flex gap-2" method="get">
        <select name="entity" defaultValue={searchParams.entity ?? ""} className={inp}>
          <option value="">כל סוגי הרשומות</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-primary text-sm px-4">סנן</button>
      </form>
      <div className="card">
        <p className="text-xs text-gray-500 mb-2">היומן נכתב אוטומטית על ידי המסד, ואי אפשר לערוך או למחוק אותו. מוצגות 200 הרשומות האחרונות.</p>
        <AuditList entries={(data ?? []) as AuditEntry[]} names={names} />
      </div>
    </div>
  );
}
