import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { saveSupplier } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inp, lbl } from "@/components/ui";

function Fields({ s }: { s?: any }) {
  return (
    <>
      <input name="name" defaultValue={s?.name ?? ""} placeholder="שם הספק" className={inp} required />
      <div className="grid grid-cols-2 gap-2">
        <input name="phone" defaultValue={s?.phone ?? ""} placeholder="טלפון" className={inp} dir="ltr" />
        <input name="field" defaultValue={s?.field ?? ""} placeholder="תחום (ניקיון, מעלית...)" className={inp} />
        <input name="monthly_cost" type="number" step="0.01" min="0" defaultValue={s?.monthly_cost ?? ""} placeholder="עלות חודשית" className={inp} />
        <input name="contract_url" defaultValue={s?.contract_url ?? ""} placeholder="קישור לחוזה" className={inp} dir="ltr" />
        <div><label className={lbl}>תחילת חוזה</label><input name="contract_start" type="date" defaultValue={s?.contract_start ?? ""} className={inp} /></div>
        <div><label className={lbl}>סיום חוזה</label><input name="contract_end" type="date" defaultValue={s?.contract_end ?? ""} className={inp} /></div>
      </div>
    </>
  );
}

export default async function SuppliersPage() {
  const supabase = createClient();
  const u = await getCurrentAppUser();
  const { data } = await supabase.from("suppliers").select("*").eq("building_id", u?.building_id).order("name");
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">ספקים</h1>
        <Link href="/manage" className="text-sm text-brand-600 font-semibold">ניהול ←</Link>
      </div>
      <details className="card">
        <summary className="font-semibold cursor-pointer text-sm">+ ספק חדש</summary>
        <ActionForm action={saveSupplier} className="space-y-2 mt-3">
          <Fields />
          <SubmitButton>הוסף ספק</SubmitButton>
        </ActionForm>
      </details>
      <div className="card divide-y divide-gray-100">
        {(data ?? []).map((s: any) => (
          <details key={s.id} className="py-2">
            <summary className="cursor-pointer text-sm"><b>{s.name}</b>{s.field ? ` · ${s.field}` : ""}{s.phone ? ` · ${s.phone}` : ""}</summary>
            <ActionForm action={saveSupplier} keepOnSuccess className="space-y-2 mt-2">
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="row_version" value={s.row_version} />
              <Fields s={s} />
              <SubmitButton>שמור</SubmitButton>
            </ActionForm>
          </details>
        ))}
        {!(data ?? []).length && <p className="text-sm text-gray-400 py-2">אין עדיין ספקים.</p>}
      </div>
    </div>
  );
}
