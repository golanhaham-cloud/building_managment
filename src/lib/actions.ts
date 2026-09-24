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

async function logAction(
  buildingId: string,
  userId: string,
  actionType: string,
  entityType: string,
  entityId: string | null,
  newValue: Record<string, unknown>
) {
  const supabase = createClient();
  await supabase.from("audit_log").insert({
    building_id: buildingId,
    user_id: userId,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
    new_value: newValue,
  });
}

export async function addTransaction(formData: FormData) {
  const appUser = await requireAdmin();
  const supabase = createClient();

  const type = formData.get("type") as "income" | "expense";
  const amount = Number(formData.get("amount"));
  const date = formData.get("date") as string;
  const description = formData.get("description") as string;

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      building_id: appUser.building_id,
      type,
      amount,
      date,
      description,
      entered_by: appUser.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAction(appUser.building_id!, appUser.id, "create", "transaction", data.id, {
    type,
    amount,
    description,
  });

  revalidatePath("/finances");
  revalidatePath("/dashboard");
}

export async function markPayment(formData: FormData) {
  const appUser = await requireAdmin();
  const supabase = createClient();

  const apartmentId = formData.get("apartment_id") as string;
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const amountDue = Number(formData.get("amount_due"));
  const amountPaid = Number(formData.get("amount_paid"));

  let status: "paid" | "partial" | "unpaid" = "unpaid";
  if (amountPaid >= amountDue && amountDue > 0) status = "paid";
  else if (amountPaid > 0) status = "partial";

  const { error } = await supabase.from("monthly_payments").upsert(
    {
      apartment_id: apartmentId,
      year,
      month,
      amount_due: amountDue,
      amount_paid: amountPaid,
      status,
      paid_date: amountPaid > 0 ? new Date().toISOString().slice(0, 10) : null,
      updated_by: appUser.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "apartment_id,year,month" }
  );

  if (error) throw new Error(error.message);

  await logAction(appUser.building_id!, appUser.id, "update", "monthly_payment", apartmentId, {
    year,
    month,
    amount_paid: amountPaid,
    status,
  });

  revalidatePath("/payments");
  revalidatePath("/dashboard");
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

  await logAction(appUser.building_id!, appUser.id, "create", "project", data.id, { title });

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

  await logAction(appUser.building_id!, appUser.id, "update", "request", requestId, { status });

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

  await logAction(appUser.building_id!, appUser.id, "create", "announcement", data.id, { title });

  revalidatePath("/announcements");
}
