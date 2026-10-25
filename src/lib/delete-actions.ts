"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { friendlyError } from "@/lib/errors";

export type DeleteResult = { ok: boolean; message: string };

const KINDS = ["announcement", "request"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh() {
  for (const p of ["/announcements", "/requests", "/dashboard", "/manage/deleted", "/manage"]) revalidatePath(p);
}

async function call(fn: "soft_delete_item" | "restore_item", kind: string, id: string, okMessage: string): Promise<DeleteResult> {
  try {
    if (!(KINDS as readonly string[]).includes(kind) || !UUID_RE.test(id)) return { ok: false, message: "פריט לא תקין." };
    // Authorization is decided inside the database function (role, ownership, same building); this is just a sign-in gate.
    const u = await getCurrentAppUser();
    if (!u) return { ok: false, message: "יש להתחבר מחדש." };
    const { error } = await createClient().rpc(fn, { p_kind: kind, p_id: id });
    if (error) return { ok: false, message: friendlyError(error) };
    refresh();
    return { ok: true, message: okMessage };
  } catch (e) {
    return { ok: false, message: friendlyError(e) };
  }
}

export async function deleteItem(kind: string, id: string): Promise<DeleteResult> {
  return call("soft_delete_item", kind, id, "הפריט נמחק והוסר מהרשימות. הוועד יכול לשחזר אותו.");
}

export async function restoreItem(kind: string, id: string): Promise<DeleteResult> {
  return call("restore_item", kind, id, "הפריט שוחזר.");
}
