"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { friendlyError } from "@/lib/errors";
import { revalidatePath } from "next/cache";

type State = { ok: boolean; message: string; id?: string } | null;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function run(paths: string[], fn: () => Promise<{ message: string; id?: string }>): Promise<State> {
  try {
    const r = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, message: friendlyError(e) };
  }
}

// Open a request (any signed-in resident). Urgency is required for new requests.
export async function openRequest(_p: State, fd: FormData): Promise<State> {
  return run(["/requests"], async () => {
    const u = await getCurrentAppUser();
    if (!u) throw new Error("יש להתחבר");
    const supabase = createClient();
    const title = s(fd, "title");
    const urgency = s(fd, "urgency");
    if (!title) throw new Error("יש להזין כותרת");
    if (!["low", "normal", "high", "urgent"].includes(urgency)) throw new Error("יש לבחור דחיפות");
    let apartmentId: string | null = null;
    if (u.resident_id) {
      const { data: resident } = await supabase.from("residents").select("apartment_id").eq("id", u.resident_id).single();
      apartmentId = resident?.apartment_id ?? null;
    }
    const { data, error } = await supabase
      .from("requests")
      .insert({
        building_id: u.building_id, apartment_id: apartmentId, opened_by: u.id,
        title, description: s(fd, "description") || null, category: s(fd, "category") || null, urgency,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { message: "הפנייה נפתחה.", id: data.id };
  });
}

export async function registerRequestAttachment(_p: State, fd: FormData): Promise<State> {
  return run(["/requests", `/requests/${s(fd, "request_id")}`], async () => {
    const supabase = createClient();
    const { error } = await supabase.rpc("register_request_attachment", {
      p_request: s(fd, "request_id"), p_path: s(fd, "path"), p_name: s(fd, "name"),
    });
    if (error) throw new Error(error.message);
    return { message: "הקובץ צורף." };
  });
}

export async function removeRequestAttachment(_p: State, fd: FormData): Promise<State> {
  return run(["/requests", `/requests/${s(fd, "request_id")}`], async () => {
    const supabase = createClient();
    const { error } = await supabase.rpc("remove_request_attachment", { p_id: s(fd, "id") });
    if (error) throw new Error(error.message);
    return { message: "הקובץ הוסר מהפנייה." };
  });
}

export async function registerCommitteeDocument(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/documents"], async () => {
    const supabase = createClient();
    const { error } = await supabase.rpc("register_committee_document", {
      p_title: s(fd, "title"), p_date: s(fd, "date") || null, p_path: s(fd, "path"), p_name: s(fd, "name"),
    });
    if (error) throw new Error(error.message);
    return { message: "המסמך נשמר בארכיון." };
  });
}

export async function removeCommitteeDocument(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/documents"], async () => {
    const supabase = createClient();
    const { error } = await supabase.rpc("remove_committee_document", { p_id: s(fd, "id") });
    if (error) throw new Error(error.message);
    return { message: "המסמך הוסר מהרשימה (נשמר ביומן)." };
  });
}
