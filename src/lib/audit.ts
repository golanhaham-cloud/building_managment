import type { SupabaseClient } from "@supabase/supabase-js";

export const FIELD_LABELS: Record<string, string> = {
  amount: "סכום", date: "תאריך", description: "תיאור", type: "סוג", notes: "הערות", category_id: "קטגוריה",
  supplier_id: "ספק", source_apartment_id: "דירה", voided_at: "בוטל בתאריך", void_reason: "סיבת ביטול",
  full_name: "שם", phone: "טלפון", email: "מייל", ownership: "בעלות", lives_here: "מתגורר בדירה",
  is_active: "פעיל", move_in_date: "תאריך כניסה", move_out_date: "תאריך עזיבה", is_primary_contact: "איש קשר ראשי",
  is_committee: "חבר ועד", apartment_number: "מספר דירה", floor: "קומה", rooms: "חדרים",
  apartment_type: "סוג דירה", occupancy_status: "מצב דירה", occupants_count: "מספר נפשות", is_rented: "מושכרת",
  amount_paid: "שולם", amount_due: "חיוב", status: "סטטוס", effective_from: "תחילת תוקף", scope: "היקף",
  reason: "סיבה", role: "תפקיד", title: "כותרת", body: "תוכן", name: "שם", note: "הערה", is_important: "חשוב",
  estimated_cost: "עלות משוערת", funded_so_far: "מומן עד כה", target_date: "תאריך יעד", monthly_cost: "עלות חודשית",
  urgency: "דחיפות", assignee: "אחראי", due_date: "תאריך יעד", doc_date: "תאריך מסמך", file_name: "שם קובץ", removed_at: "הוסר בתאריך", deleted_at: "נמחק בתאריך", deleted_by: "נמחק על ידי", is_complete: "הושלם", fee_year: "שנת ועד", fee_month: "חודש ועד", year: "שנה", month: "חודש",
};

export const ENTITY_LABELS: Record<string, string> = {
  apartments: "דירה", residents: "דייר", transactions: "תנועה כספית", monthly_payments: "חיוב ועד",
  fee_tariffs: "תעריף", fee_tariff_apartments: "דירות בתעריף", fee_adjustments: "זיכוי/חיוב נוסף",
  suppliers: "ספק", announcements: "הודעה", projects: "תוכנית", requests: "פנייה", documents: "מסמך",
  internal_notes: "הערה פנימית", committee_tasks: "משימת ועד", committee_documents: "מסמך ועד", request_attachments: "קובץ בפנייה", app_users: "הרשאות משתמש", join_requests: "בקשת הצטרפות", forecast_items: "סעיף תחזית", forecast_settings: "הנחות תחזית", forecast_scenarios: "תרחיש תחזית", forecast_one_offs: "הוצאה צפויה מיוחדת", categories: "קטגוריה",
};

const SKIP = new Set(["row_version", "updated_at", "created_at", "idempotency_key"]);

export type AuditEntry = {
  id: string;
  user_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};

export function describeChanges(e: AuditEntry): { label: string; from: string; to: string }[] {
  const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "כן" : "לא") : String(v));
  if (e.action_type === "update" && e.old_value && e.new_value) {
    return Object.keys(e.new_value)
      .filter((k) => !SKIP.has(k) && JSON.stringify(e.old_value![k]) !== JSON.stringify(e.new_value![k]))
      .map((k) => ({ label: FIELD_LABELS[k] ?? k, from: fmt(e.old_value![k]), to: fmt(e.new_value![k]) }));
  }
  const src = (e.new_value ?? e.old_value) as Record<string, unknown> | null;
  if (!src) return [];
  const keys = ["amount", "date", "description", "full_name", "apartment_number", "name", "title", "effective_from", "scope", "reason", "status", "role", "note"];
  return keys
    .filter((k) => k in src && src[k] !== null && src[k] !== "")
    .map((k) => ({ label: FIELD_LABELS[k] ?? k, from: "", to: fmt(src[k]) }));
}

export async function userNameMap(supabase: SupabaseClient, ids: (string | null)[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))) as string[];
  const map = new Map<string, string>();
  if (!uniq.length) return map;
  const { data: users } = await supabase.from("app_users").select("id, resident_id").in("id", uniq);
  const resIds = (users ?? []).map((u: any) => u.resident_id).filter(Boolean);
  const { data: res } = resIds.length ? await supabase.from("residents").select("id, full_name").in("id", resIds) : { data: [] as any[] };
  const names = new Map((res ?? []).map((r: any) => [r.id, r.full_name]));
  for (const u of users ?? []) map.set((u as any).id, names.get((u as any).resident_id) ?? "חבר ועד");
  return map;
}
