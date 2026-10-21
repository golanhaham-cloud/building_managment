import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { saveApartment, savePerson, deactivatePerson, reactivatePerson, addNote } from "@/lib/manage-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import AuditList from "@/components/AuditList";
import { userNameMap, type AuditEntry } from "@/lib/audit";
import { inp, lbl, btnDanger } from "@/components/ui";
import { OCCUPANCY_LABELS } from "@/lib/errors";

function PersonFields({ p }: { p?: any }) {
  return (
    <>
      <input name="full_name" defaultValue={p?.full_name ?? ""} placeholder="שם מלא" className={inp} required />
      <div className="grid grid-cols-2 gap-2">
        <select name="ownership" defaultValue={p?.ownership ?? "owner"} className={inp}>
          <option value="owner">בעל/ת הדירה</option>
          <option value="tenant">שוכר/ת</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="lives_here" defaultChecked={p ? p.lives_here : true} /> מתגורר/ת בדירה</label>
      </div>
      <input name="phone" defaultValue={p?.phone ?? ""} placeholder="טלפון" className={inp} dir="ltr" />
      <input name="email" type="email" defaultValue={p?.email ?? ""} placeholder="מייל" className={inp} dir="ltr" />
      <div className="grid grid-cols-2 gap-2">
        <div><label className={lbl}>תאריך כניסה</label><input name="move_in_date" type="date" defaultValue={p?.move_in_date ?? ""} className={inp} /></div>
        <div><label className={lbl}>תאריך עזיבה</label><input name="move_out_date" type="date" defaultValue={p?.move_out_date ?? ""} className={inp} /></div>
      </div>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="is_primary_contact" defaultChecked={p?.is_primary_contact ?? false} /> איש קשר ראשי</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_committee" defaultChecked={p?.is_committee ?? false} /> חבר/ת ועד (תווית בלבד)</label>
      </div>
    </>
  );
}

export default async function ApartmentDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const u = await getCurrentAppUser();
  const { data: apt } = await supabase.from("apartments").select("*").eq("id", params.id).eq("building_id", u?.building_id).maybeSingle();
  if (!apt) notFound();

  const { data: all } = await supabase.from("residents").select("*").eq("apartment_id", apt.id).order("created_at");
  const people = all ?? [];
  const active = people.filter((p: any) => p.is_active);
  const past = people.filter((p: any) => !p.is_active);
  const ids = [apt.id, ...people.map((p: any) => p.id)];

  const { data: notes } = await supabase.from("internal_notes").select("id, entity_type, entity_id, note, created_at").in("entity_id", ids).order("created_at", { ascending: false });
  const { data: log } = await supabase.from("audit_log").select("*").in("entity_id", ids).order("created_at", { ascending: false }).limit(60);
  const names = await userNameMap(supabase, (log ?? []).map((l: any) => l.user_id));

  const { data: pays } = await supabase
    .from("monthly_payments")
    .select("year, month, amount_due, amount_paid, status")
    .eq("apartment_id", apt.id)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(12);

  const path = `/manage/apartments/${apt.id}`;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">דירה {apt.apartment_number}</h1>
        <Link href="/manage/apartments" className="text-sm text-brand-600 font-semibold">הרשימה ←</Link>
      </div>

      <ActionForm action={saveApartment} keepOnSuccess className="card space-y-2">
        <div className="font-semibold text-sm">פרטי הדירה</div>
        <input type="hidden" name="id" value={apt.id} />
        <input type="hidden" name="row_version" value={apt.row_version} />
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lbl}>מספר דירה</label><input name="apartment_number" defaultValue={apt.apartment_number} className={inp} required /></div>
          <div><label className={lbl}>קומה</label><input name="floor" type="number" defaultValue={apt.floor} className={inp} required /></div>
          <div><label className={lbl}>סוג דירה</label><input name="apartment_type" defaultValue={apt.apartment_type ?? ""} className={inp} /></div>
          <div><label className={lbl}>חדרים</label><input name="rooms" type="number" step="0.5" min="0" defaultValue={apt.rooms ?? ""} className={inp} /></div>
          <div>
            <label className={lbl}>מצב הדירה</label>
            <select name="occupancy_status" defaultValue={apt.occupancy_status} className={inp}>
              {Object.entries(OCCUPANCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label className={lbl}>מספר נפשות</label><input name="occupants_count" type="number" min="0" defaultValue={apt.occupants_count ?? ""} className={inp} /></div>
        </div>
        <SubmitButton>שמור פרטי דירה</SubmitButton>
      </ActionForm>

      <div className="card space-y-3">
        <div className="font-semibold text-sm">אנשים פעילים בדירה</div>
        {active.length === 0 && <p className="text-sm text-gray-400">אין אנשים פעילים.</p>}
        {active.map((p: any) => (
          <details key={p.id} className="border border-gray-100 rounded-lg p-2">
            <summary className="cursor-pointer text-sm">
              <b>{p.full_name}</b> · {p.ownership === "owner" ? "בעלים" : "שוכר/ת"}{p.lives_here ? "" : " · לא מתגורר"}{p.is_committee ? " · ועד" : ""}
            </summary>
            <div className="mt-2 space-y-3">
              <ActionForm action={savePerson} keepOnSuccess className="space-y-2">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="apartment_id" value={apt.id} />
                <input type="hidden" name="row_version" value={p.row_version} />
                <PersonFields p={p} />
                <SubmitButton>שמור שינויים</SubmitButton>
              </ActionForm>
              <ActionForm action={deactivatePerson} className="space-y-2 border border-red-100 rounded-lg p-2">
                <div className="text-xs font-semibold text-status-unpaid">הוצאה מהדירה (סימון כלא פעיל)</div>
                <p className="text-xs text-gray-500">ההיסטוריה נשמרת. חובות או חיובי הדירה לא עוברים לאף אדם חדש. אם לאדם יש חשבון משתמש רגיל, הגישה שלו תוסר.</p>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="apartment_id" value={apt.id} />
                <input type="hidden" name="row_version" value={p.row_version} />
                <div><label className={lbl}>תאריך עזיבה</label><input name="move_out_date" type="date" className={inp} required /></div>
                <SubmitButton className={btnDanger} confirmText={`לסמן את ${p.full_name} כלא פעיל בדירה ${apt.apartment_number}?`}>סמן כלא פעיל</SubmitButton>
              </ActionForm>
            </div>
          </details>
        ))}

        <details>
          <summary className="cursor-pointer text-sm text-brand-600 font-semibold">+ הוספת אדם לדירה</summary>
          <ActionForm action={savePerson} className="space-y-2 mt-2">
            <input type="hidden" name="apartment_id" value={apt.id} />
            <PersonFields />
            <SubmitButton>הוסף</SubmitButton>
          </ActionForm>
        </details>
      </div>

      {past.length > 0 && (
        <div className="card space-y-2">
          <div className="font-semibold text-sm">היסטוריה - לא פעילים</div>
          {past.map((p: any) => (
            <div key={p.id} className="text-sm border-b border-gray-100 pb-2">
              <b>{p.full_name}</b> · {p.ownership === "owner" ? "בעלים" : "שוכר/ת"}
              <div className="text-xs text-gray-400">
                {p.move_in_date ? `כניסה ${new Date(p.move_in_date).toLocaleDateString("he-IL")}` : "תאריך כניסה לא ידוע"}
                {p.move_out_date ? ` · עזיבה ${new Date(p.move_out_date).toLocaleDateString("he-IL")}` : ""}
              </div>
              <ActionForm action={reactivatePerson} className="mt-1">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="apartment_id" value={apt.id} />
                <input type="hidden" name="row_version" value={p.row_version} />
                <SubmitButton className="text-xs text-brand-600 underline" confirmText="להחזיר לסטטוס פעיל?">החזר לפעיל</SubmitButton>
              </ActionForm>
            </div>
          ))}
        </div>
      )}

      <div className="card space-y-2">
        <div className="font-semibold text-sm">חיובי ועד אחרונים (לדירה, לא לאדם)</div>
        {(pays ?? []).length === 0 && <p className="text-sm text-gray-400">אין חיובים.</p>}
        {(pays ?? []).map((p: any) => (
          <div key={`${p.year}-${p.month}`} className="flex justify-between text-sm">
            <span>{p.month}/{p.year}</span>
            <span>{Number(p.amount_paid).toLocaleString("he-IL")} / {Number(p.amount_due).toLocaleString("he-IL")} ₪</span>
          </div>
        ))}
      </div>

      <div className="card space-y-2">
        <div className="font-semibold text-sm">הערות פנימיות (לוועד בלבד, לא מוצגות לדיירים)</div>
        {(notes ?? []).map((n: any) => (
          <div key={n.id} className="text-sm border-b border-gray-100 pb-1">
            {n.note}
            <div className="text-xs text-gray-400">
              {n.entity_type === "resident" ? people.find((p: any) => p.id === n.entity_id)?.full_name ?? "" : "הדירה"} · {new Date(n.created_at).toLocaleDateString("he-IL")}
            </div>
          </div>
        ))}
        <ActionForm action={addNote} className="space-y-2">
          <input type="hidden" name="entity_type" value="apartment" />
          <input type="hidden" name="entity_id" value={apt.id} />
          <input type="hidden" name="return_path" value={path} />
          <textarea name="note" rows={2} className={inp} placeholder="הערה פנימית על הדירה" required />
          <SubmitButton>שמור הערה</SubmitButton>
        </ActionForm>
      </div>

      <div className="card">
        <div className="font-semibold text-sm mb-2">יומן שינויים</div>
        <AuditList entries={(log ?? []) as AuditEntry[]} names={names} />
      </div>
    </div>
  );
}
