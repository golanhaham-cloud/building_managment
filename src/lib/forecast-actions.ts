"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseTxIds, isUuid } from "@/lib/forecast-links";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { friendlyError } from "@/lib/errors";

type State = { ok: boolean; message: string } | null;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function money(fd: FormData, k: string, required = true): number | null {
  const raw = s(fd, k).replace(/,/g, "");
  if (raw === "") { if (required) throw new Error("INVALID: יש להזין סכום"); return null; }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("INVALID: סכום לא תקין");
  return Math.round(n * 100) / 100;
}

// The database functions re-check the committee role and building; this is only a fast sign-in/role gate.
async function run(fn: (supabase: ReturnType<typeof createClient>) => Promise<string>): Promise<State> {
  try {
    const u = await getCurrentAppUser();
    if (!u || u.role !== "admin") throw new Error("NOT_ADMIN: אין לך הרשאת ועד לפעולה זו");
    const message = await fn(createClient());
    revalidatePath("/forecast");
    return { ok: true, message };
  } catch (e) {
    return { ok: false, message: friendlyError(e) };
  }
}

async function rpc(supabase: ReturnType<typeof createClient>, name: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
}

export async function saveForecastItem(_p: State, fd: FormData): Promise<State> {
  return run(async (sb) => {
    const id = s(fd, "id");
    if (id && !UUID_RE.test(id)) throw new Error("INVALID: סעיף לא תקין");
    const ver = s(fd, "row_version");
    const date = s(fd, "last_payment_date");
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("INVALID: תאריך לא תקין");
    await rpc(sb, "forecast_save_item", {
      p_id: id || null,
      p_name: s(fd, "name"),
      p_supplier: s(fd, "supplier") || null,
      p_amount: money(fd, "monthly_estimate"),
      p_kind: s(fd, "kind") || "recurring",
      p_basis: s(fd, "basis"),
      p_last_amount: money(fd, "last_payment_amount", false),
      p_last_date: date || null,
      p_notes: s(fd, "notes") || null,
      p_version: id ? Number(ver) : null,
    });
    return id ? "הסעיף עודכן." : "הסעיף נוסף.";
  });
}

export async function setForecastItemActive(_p: State, fd: FormData): Promise<State> {
  return run(async (sb) => {
    const id = s(fd, "id");
    if (!UUID_RE.test(id)) throw new Error("INVALID: סעיף לא תקין");
    const active = s(fd, "active") === "true";
    await rpc(sb, "forecast_set_item_active", { p_id: id, p_active: active, p_reason: s(fd, "reason") || null });
    return active ? "הסעיף הוחזר לתחזית." : "הסעיף הופסק והוצא מהתחזית.";
  });
}

export async function saveForecastSettings(_p: State, fd: FormData): Promise<State> {
  return run(async (sb) => {
    await rpc(sb, "forecast_save_settings", { p_refund: money(fd, "libna4_refund"), p_basis: s(fd, "refund_basis") });
    return "הנחת ההחזר עודכנה.";
  });
}

export async function setForecastScenario(_p: State, fd: FormData): Promise<State> {
  return run(async (sb) => {
    const fee = Number(s(fd, "fee_amount"));
    const n = Number(s(fd, "non_paying") || "0");
    if (!Number.isFinite(fee) || fee <= 0) throw new Error("INVALID: קבוצת תעריף לא תקינה");
    if (!Number.isInteger(n) || n < 0) throw new Error("INVALID: יש להזין מספר דירות שלם");
    await rpc(sb, "forecast_set_scenario", { p_fee_amount: fee, p_non_paying: n });
    return "התרחיש עודכן.";
  });
}

export async function addForecastOneOff(_p: State, fd: FormData): Promise<State> {
  return run(async (sb) => {
    const ym = s(fd, "ym"); // yyyy-mm
    const m = /^(\d{4})-(\d{2})$/.exec(ym);
    if (!m) throw new Error("INVALID: יש לבחור חודש");
    await rpc(sb, "forecast_add_one_off", { p_year: Number(m[1]), p_month: Number(m[2]), p_title: s(fd, "title"), p_amount: money(fd, "amount"), p_note: s(fd, "note") || null });
    return "ההוצאה הצפויה נוספה לחודש.";
  });
}

export async function voidForecastOneOff(_p: State, fd: FormData): Promise<State> {
  return run(async (sb) => {
    const id = s(fd, "id");
    if (!UUID_RE.test(id)) throw new Error("INVALID: הוצאה לא תקינה");
    await rpc(sb, "forecast_void_one_off", { p_id: id, p_reason: s(fd, "reason") });
    return "ההוצאה הוסרה מהתחזית.";
  });
}

// שיוך ידני של הוצאות להוצאה קבועה (או ביטול שיוך). כל הבדיקות המחייבות נעשות בפונקציית המסד
// link_transactions_to_forecast_item (הרשאת ועד, הוצאות פעילות בלבד, הכול או כלום, יומן ביקורת).
// לא משנה סכומים, תאריכים, יתרות או תחזית. הצלחה מוצגת רק אחרי שהשרת אישר (הפניה עם done).
export async function linkTransactionsToItem(_p: State, fd: FormData): Promise<State> {
  let done = "";
  try {
    const u = await getCurrentAppUser();
    if (!u || u.role !== "admin") throw new Error("NOT_ADMIN: אין לך הרשאת ועד לפעולה זו");
    const { ids, error } = parseTxIds(fd.getAll("tx").map(String));
    if (error) throw new Error("INVALID: " + error);
    const unlink = s(fd, "mode") === "unlink";
    const item = s(fd, "item");
    if (!unlink && !isUuid(item)) throw new Error("INVALID: יש לבחור הוצאה קבועה");
    const { data, error: e } = await createClient().rpc("link_transactions_to_forecast_item", { p_ids: ids, p_item_id: unlink ? null : item });
    if (e) throw new Error(e.message);
    const changed = Number((data as any)?.changed ?? 0);
    done = `${unlink ? "unlinked" : "linked"}.${changed}`;
    revalidatePath("/forecast"); revalidatePath("/forecast/link"); revalidatePath("/finances");
  } catch (e) {
    console.error("[forecast-link] failed:", e instanceof Error ? e.message : e);
    return { ok: false, message: friendlyError(e) };
  }
  const keep = new URLSearchParams();
  for (const k of ["q", "cat", "show"]) { const v = s(fd, k); if (v) keep.set(k, v); }
  keep.set("done", done);
  redirect(`/forecast/link?${keep.toString()}`);
}
