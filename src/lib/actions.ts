"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") {
    throw new Error("אין לך הרשאה לבצע פעולה זו");
  }
  return appUser;
}

export async function createProject(formData: FormData) {
  const appUser = await requireAdmin();
  const supabase = createClient();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const estimatedCost = Number(formData.get("estimated_cost") || 0);
  const targetDate = (formData.get("target_date") as string) || null;

  const { data, error } = await supabase
    .from("projects")
    .insert({
      building_id: appUser.building_id,
      title,
      description,
      estimated_cost: estimatedCost,
      target_date: targetDate,
      created_by: appUser.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);


  revalidatePath("/projects");
}

export async function updateRequestStatus(formData: FormData) {
  const appUser = await requireAdmin();
  const supabase = createClient();

  const requestId = formData.get("request_id") as string;
  const status = formData.get("status") as string;

  const { error } = await supabase
    .from("requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) throw new Error(error.message);

  await supabase.from("request_updates").insert({
    request_id: requestId,
    status: status as any,
    updated_by: appUser.id,
  });


  revalidatePath("/requests");
}

export async function createRequest(formData: FormData) {
  const appUser = await getCurrentAppUser();
  if (!appUser) throw new Error("יש להתחבר");
  const supabase = createClient();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const category = formData.get("category") as string;

  let apartmentId: string | null = null;
  if (appUser.resident_id) {
    const { data: resident } = await supabase
      .from("residents")
      .select("apartment_id")
      .eq("id", appUser.resident_id)
      .single();
    apartmentId = resident?.apartment_id ?? null;
  }

  const { error } = await supabase.from("requests").insert({
    building_id: appUser.building_id,
    apartment_id: apartmentId,
    opened_by: appUser.id,
    title,
    description,
    category,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/requests");
}

export async function createAnnouncement(formData: FormData) {
  const appUser = await requireAdmin();
  const supabase = createClient();

  const title = formData.get("title") as string;
  const body = formData.get("body") as string;
  const isImportant = formData.get("is_important") === "on";

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      building_id: appUser.building_id,
      title,
      body,
      is_important: isImportant,
      created_by: appUser.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);


  revalidatePath("/announcements");
}

export interface ImportRowInput {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  apartment_id: string | null;
  mark_payment: boolean;
}

export async function importTransactions(rows: ImportRowInput[]) {
  const appUser = await requireAdmin();
  const supabase = createClient();

  const valid = rows.filter(
    (r) =>
      /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
      Number.isFinite(r.amount) &&
      r.amount > 0 &&
      (r.type === "income" || r.type === "expense")
  );
  if (!valid.length) return { inserted: 0, skipped: rows.length, unlinked: 0 };

  const dates = valid.map((r) => r.date).sort();
  const { data: existing } = await supabase
    .from("transactions")
    .select("date, amount, type, description")
    .eq("building_id", appUser.building_id)
    .is("voided_at", null)
    .gte("date", dates[0])
    .lte("date", dates[dates.length - 1]);

  const key = (d: string, a: number, t: string, desc: string | null) =>
    `${d}|${Number(a).toFixed(2)}|${t}|${(desc ?? "").trim()}`;
  const seen = new Map<string, number>();
  for (const e of existing ?? []) {
    const k = key(e.date, e.amount, e.type, e.description);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }

  let inserted = 0;
  let unlinked = 0;
  for (const r of valid) {
    const k = key(r.date, r.amount, r.type, r.description);
    const n = seen.get(k) ?? 0;
    if (n > 0) {
      seen.set(k, n - 1);
      continue;
    }
    const year = Number(r.date.slice(0, 4));
    const month = Number(r.date.slice(5, 7));
    let feeYear: number | null = null;
    let feeMonth: number | null = null;
    if (r.mark_payment && r.apartment_id && r.type === "income") {
      const { data: charge } = await supabase
        .from("monthly_payments")
        .select("id")
        .eq("apartment_id", r.apartment_id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      if (charge) {
        feeYear = year;
        feeMonth = month;
      } else {
        unlinked++;
      }
    }
    const { error } = await supabase.rpc("create_transaction", {
      p_type: r.type,
      p_date: r.date,
      p_amount: r.amount,
      p_description: r.description || null,
      p_category: null,
      p_supplier: null,
      p_apartment: r.type === "income" ? r.apartment_id : null,
      p_fee_year: feeYear,
      p_fee_month: feeMonth,
      p_notes: "יובא מקובץ בנק",
      p_payment_method: "bank",
      p_key: null,
    });
    if (error) throw new Error(error.message);
    inserted++;
  }

  revalidatePath("/finances");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { inserted, skipped: valid.length - inserted, unlinked };
}
