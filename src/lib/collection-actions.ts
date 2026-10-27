"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { friendlyError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type State = { ok: boolean; message: string } | null;

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// שער ועד בצד השרת; אחריו הפונקציות במסד בודקות שוב הרשאת ועד, בניין, גבולות הפער וכפילות עם זיכוי קיים.
// ההחלטות אינן תשלום: אינן נוגעות בהכנסות, בחיובים, בהתאמות או בשיוכים.
// אחרי הצלחה: הפניה עם קוד קבוע והחזרת הסינון, כדי שההודעה תוצג אחרי הטעינה מחדש.
async function run(fd: FormData, fn: () => Promise<string>): Promise<State> {
  let code: string;
  try {
    const u = await getCurrentAppUser();
    if (!u || u.role !== "admin") throw new Error("NOT_ADMIN: אין לך הרשאת ועד לפעולה זו");
    code = await fn();
    revalidatePath("/manage/collection");
  } catch (e) {
    // נרשם ביומן השרת (Vercel runtime logs) כדי שאפשר יהיה לאתר את הגורם בכשל. ההודעה למשתמש לא משתנה.
    console.error("[collection-action] failed:", e instanceof Error ? e.message : e);
    return { ok: false, message: friendlyError(e) };
  }
  const keep = new URLSearchParams();
  for (const k of ["apt", "from", "to", "all"]) {
    const v = s(fd, `f_${k}`);
    if (v) keep.set(k, v);
  }
  keep.set("done", code);
  redirect(`/manage/collection?${keep.toString()}`);
}

export async function saveGapDecision(_p: State, fd: FormData): Promise<State> {
  return run(fd, async () => {
    const kind = s(fd, "kind");
    if (kind !== "reduction" && kind !== "verified_debt") throw new Error("INVALID: יש לבחור סוג החלטה");
    const apt = s(fd, "apartment_id");
    if (!/^[0-9a-f-]{36}$/i.test(apt)) throw new Error("INVALID: דירה לא תקינה");
    const amount = Number(s(fd, "amount"));
    if (!(amount > 0) || !/^\d{1,8}(\.\d{1,2})?$/.test(s(fd, "amount"))) throw new Error("INVALID: יש להזין סכום חיובי (עד שתי ספרות אחרי הנקודה)");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("set_gap_decision", {
      p_apt: apt,
      p_year: Number(s(fd, "year")),
      p_month: Number(s(fd, "month")),
      p_kind: kind,
      p_amount: amount,
      p_reason: s(fd, "reason"),
      p_reported_on: s(fd, "reported_on") || null,
    });
    if (error) throw new Error(error.message);
    return `${data?.status === "updated" ? "updated" : "created"}.${kind}`;
  });
}

export async function voidGapDecision(_p: State, fd: FormData): Promise<State> {
  return run(fd, async () => {
    const supabase = createClient();
    const { error } = await supabase.rpc("void_gap_decision", { p_id: s(fd, "id"), p_reason: s(fd, "reason") });
    if (error) throw new Error(error.message);
    return "voided.x";
  });
}
