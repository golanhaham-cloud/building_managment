"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { friendlyError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type State = { ok: boolean; message: string } | null;

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const keyOf = (fd: FormData) => {
  const k = s(fd, "idempotency_key");
  return /^[0-9a-f-]{36}$/i.test(k) ? k : null;
};
const PATHS = ["/payments", "/payments/allocate", "/finances", "/dashboard"];

// שער ועד בצד השרת, ואחריו הפונקציה במסד בודקת שוב הרשאת ועד ובניין. הדייר לא מגיע לכאן בפועל.
// אחרי הצלחה העמוד נטען מחדש (revalidate) והטופס נבנה מחדש, ולכן ההודעה עוברת בהפניה כקוד קבוע
// (לא טקסט חופשי מה-URL) והעמוד מציג אותה מהשרת. שגיאה מוחזרת כרגיל לטופס, והערכים שהוזנו נשארים.
async function run(fd: FormData, fn: () => Promise<string>): Promise<State> {
  let code: string;
  try {
    const u = await getCurrentAppUser();
    if (!u || u.role !== "admin") throw new Error("NOT_ADMIN: אין לך הרשאת ועד לפעולה זו");
    code = await fn();
    for (const p of PATHS) revalidatePath(p);
  } catch (e) {
    return { ok: false, message: friendlyError(e) };
  }
  redirect(`/payments/allocate?${s(fd, "mode") === "new" ? "mode=new&" : ""}done=${code}`);
}

function items(fd: FormData): unknown[] {
  let v: unknown;
  try {
    v = JSON.parse(s(fd, "items") || "[]");
  } catch {
    throw new Error("INVALID: נתוני השיוך לא תקינים");
  }
  if (!Array.isArray(v) || v.length === 0) throw new Error("INVALID: לא נבחר שיוך");
  return v;
}

// שיוך הכנסה קיימת: לא נוצרת הכנסה חדשה ויתרת הקופה אינה משתנה.
export async function allocateExistingIncome(_p: State, fd: FormData): Promise<State> {
  return run(fd, async () => {
    const tx = s(fd, "transaction_id");
    if (!/^[0-9a-f-]{36}$/i.test(tx)) throw new Error("INVALID: יש לבחור הכנסה קיימת");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("allocate_income", { p_tx: tx, p_items: items(fd) });
    if (error) throw new Error(error.message);
    return `allocated.${Number(data?.count ?? 0)}`;
  });
}

// תשלום חדש שבאמת אינו קיים בכספים: הכנסה אחת ושיוכים אליה, או הכול או כלום.
export async function recordNewIncomeWithAllocations(_p: State, fd: FormData): Promise<State> {
  return run(fd, async () => {
    const amount = Number(s(fd, "amount"));
    if (!(amount > 0)) throw new Error("INVALID: יש להזין סכום חיובי");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("record_income_with_allocations", {
      p_date: s(fd, "date") || new Date().toISOString().slice(0, 10),
      p_amount: amount,
      p_description: s(fd, "description") || null,
      p_method: s(fd, "method") || null,
      p_notes: s(fd, "notes") || null,
      p_key: keyOf(fd),
      p_items: items(fd),
    });
    if (error) throw new Error(error.message);
    return data?.status === "duplicate" ? "duplicate.0" : `created.${Number(data?.count ?? 0)}`;
  });
}

// ביטול הקצאה משחרר רק את הסכום שהוקצה. ההכנסה המקורית אינה נמחקת ואינה משתנה.
export async function voidAllocation(_p: State, fd: FormData): Promise<State> {
  return run(fd, async () => {
    const supabase = createClient();
    const { error } = await supabase.rpc("void_allocation", { p_id: s(fd, "id"), p_reason: s(fd, "reason") });
    if (error) throw new Error(error.message);
    return "voided.0";
  });
}

export async function updateAllocationBasis(_p: State, fd: FormData): Promise<State> {
  return run(fd, async () => {
    const supabase = createClient();
    const { error } = await supabase.rpc("update_allocation_basis", {
      p_id: s(fd, "id"),
      p_apartment_basis: s(fd, "apartment_basis") || null,
      p_months_basis: s(fd, "months_basis") || null,
      p_note: s(fd, "basis_note") || null,
      p_reason: s(fd, "reason"),
    });
    if (error) throw new Error(error.message);
    return "basis.0";
  });
}
