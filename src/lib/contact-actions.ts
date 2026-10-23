"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export type ContactResult =
  | { ok: true; full_name: string; phone: string | null; email: string | null }
  | { ok: false; message: string };

// Server-side gate + database gate: the RPC itself only answers signed-in users of the same building.
export async function getResidentContact(residentId: string): Promise<ContactResult> {
  if (!/^[0-9a-f-]{36}$/i.test(residentId)) return { ok: false, message: "בקשה לא תקינה" };
  const u = await getCurrentAppUser();
  if (!u) return { ok: false, message: "יש להתחבר כדי לראות פרטי קשר" };
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_resident_contact", { p_resident: residentId });
  if (error) return { ok: false, message: "לא ניתן לטעון את פרטי הקשר כעת" };
  const row = (data as any[] | null)?.[0];
  if (!row) return { ok: false, message: "פרטי הקשר אינם זמינים" };
  return { ok: true, full_name: row.full_name, phone: row.phone ?? null, email: row.email ?? null };
}
