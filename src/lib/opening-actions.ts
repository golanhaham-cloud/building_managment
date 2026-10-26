"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { friendlyError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type State = { ok: boolean; message: string } | null;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ועד בלבד: שער בצד השרת, ואחריו הפונקציה במסד בודקת שוב הרשאת ועד, סכום, תאריך וסיבה.
export async function saveOpeningBalance(_p: State, fd: FormData): Promise<State> {
  try {
    const u = await getCurrentAppUser();
    if (!u || u.role !== "admin") throw new Error("NOT_ADMIN: אין לך הרשאת ועד לפעולה זו");
    const raw = s(fd, "amount").replace(/,/g, "");
    if (!/^-?\d{1,9}(\.\d{1,2})?$/.test(raw)) throw new Error("INVALID: יש להזין סכום תקין (עד שתי ספרות אחרי הנקודה)");
    const supabase = createClient();
    const { error } = await supabase.rpc("set_opening_balance", { p_amount: Number(raw), p_start_date: s(fd, "start_date"), p_reason: s(fd, "reason") });
    if (error) throw new Error(error.message);
    for (const p of ["/dashboard", "/finances", "/manage/opening-balance"]) revalidatePath(p);
  } catch (e) {
    return { ok: false, message: friendlyError(e) };
  }
  // אחרי revalidate הטופס נבנה מחדש, ולכן ההצלחה עוברת בהפניה והעמוד מציג אותה מהשרת.
  redirect("/manage/opening-balance?saved=1");
}
