"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { friendlyError } from "@/lib/errors";
import { revalidatePath } from "next/cache";

type State = { ok: boolean; message: string } | null;

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string): number | null => {
  const v = s(fd, k);
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("ערך מספרי לא תקין");
  return n;
};
const keyOf = (fd: FormData) => {
  const k = s(fd, "idempotency_key");
  return /^[0-9a-f-]{36}$/i.test(k) ? k : null;
};

async function admin() {
  const u = await getCurrentAppUser();
  if (!u || u.role !== "admin") throw new Error("NOT_ADMIN: אין לך הרשאת ועד לפעולה זו");
  return u;
}

async function run(paths: string[], fn: () => Promise<string>): Promise<State> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message };
  } catch (e) {
    return { ok: false, message: friendlyError(e) };
  }
}

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ---------- apartments & people ----------

export async function saveApartment(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/apartments", "/apartments"], async () => {
    const u = await admin();
    const supabase = createClient();
    const id = s(fd, "id");
    const number = s(fd, "apartment_number");
    const floor = num(fd, "floor");
    if (!number) throw new Error("חובה להזין מספר דירה");
    if (floor === null) throw new Error("חובה להזין קומה");
    const status = s(fd, "occupancy_status") || "owner_occupied";
    if (!["owner_occupied", "rented", "vacant"].includes(status)) throw new Error("מצב דירה לא תקין");
    const payload = {
      apartment_number: number,
      floor,
      apartment_type: s(fd, "apartment_type") || null,
      rooms: num(fd, "rooms"),
      occupancy_status: status,
      occupants_count: num(fd, "occupants_count"),
    };
    if (id) {
      const ver = num(fd, "row_version");
      const data = must(
        await supabase.from("apartments").update({ ...payload, row_version: ver }).eq("id", id).eq("building_id", u.building_id).select("id")
      );
      if (!data?.length) throw new Error("הדירה לא נמצאה");
      revalidatePath(`/manage/apartments/${id}`);
      return "הדירה עודכנה.";
    }
    must(await supabase.from("apartments").insert({ ...payload, building_id: u.building_id }).select("id"));
    return "הדירה נוספה.";
  });
}

export async function savePerson(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/apartments", "/apartments"], async () => {
    const u = await admin();
    const supabase = createClient();
    const id = s(fd, "id");
    const apartmentId = s(fd, "apartment_id");
    const name = s(fd, "full_name");
    if (!name) throw new Error("חובה להזין שם");
    const ownership = s(fd, "ownership");
    if (!["owner", "tenant"].includes(ownership)) throw new Error("יש לבחור בעל דירה או שוכר");
    const email = s(fd, "email").toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("כתובת מייל לא תקינה");
    const moveIn = s(fd, "move_in_date") || null;
    const moveOut = s(fd, "move_out_date") || null;
    if (moveIn && moveOut && moveOut < moveIn) throw new Error("תאריך העזיבה מוקדם מתאריך הכניסה");

    const { data: apt } = await supabase.from("apartments").select("id").eq("id", apartmentId).eq("building_id", u.building_id).maybeSingle();
    if (!apt) throw new Error("הדירה לא נמצאה");

    const payload = {
      full_name: name,
      ownership,
      lives_here: fd.get("lives_here") === "on",
      phone: s(fd, "phone") || null,
      email: email || null,
      move_in_date: moveIn,
      move_out_date: moveOut,
      is_primary_contact: fd.get("is_primary_contact") === "on",
      is_committee: fd.get("is_committee") === "on",
    };
    if (id) {
      const data = must(
        await supabase.from("residents").update({ ...payload, row_version: num(fd, "row_version") }).eq("id", id).eq("apartment_id", apartmentId).select("id")
      );
      if (!data?.length) throw new Error("האדם לא נמצא");
      revalidatePath(`/manage/apartments/${apartmentId}`);
      return "הפרטים עודכנו.";
    }
    must(await supabase.from("residents").insert({ ...payload, apartment_id: apartmentId, is_active: true }).select("id"));
    revalidatePath(`/manage/apartments/${apartmentId}`);
    return "האדם נוסף לדירה.";
  });
}

export async function deactivatePerson(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/apartments", "/apartments"], async () => {
    const u = await admin();
    const supabase = createClient();
    const id = s(fd, "id");
    const apartmentId = s(fd, "apartment_id");
    const moveOut = s(fd, "move_out_date");
    if (!moveOut) throw new Error("חובה להזין תאריך עזיבה");
    const { data: apt } = await supabase.from("apartments").select("id").eq("id", apartmentId).eq("building_id", u.building_id).maybeSingle();
    if (!apt) throw new Error("הדירה לא נמצאה");
    const data = must(
      await supabase
        .from("residents")
        .update({ is_active: false, move_out_date: moveOut, row_version: num(fd, "row_version") })
        .eq("id", id)
        .eq("apartment_id", apartmentId)
        .select("id")
    );
    if (!data?.length) throw new Error("האדם לא נמצא");
    revalidatePath(`/manage/apartments/${apartmentId}`);
    return "האדם סומן כלא פעיל. ההיסטוריה נשמרה, וחובות הדירה לא הועברו לאף אחד.";
  });
}

export async function reactivatePerson(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/apartments", "/apartments"], async () => {
    const u = await admin();
    const supabase = createClient();
    const id = s(fd, "id");
    const apartmentId = s(fd, "apartment_id");
    const { data: apt } = await supabase.from("apartments").select("id").eq("id", apartmentId).eq("building_id", u.building_id).maybeSingle();
    if (!apt) throw new Error("הדירה לא נמצאה");
    must(await supabase.from("residents").update({ is_active: true, move_out_date: null, row_version: num(fd, "row_version") }).eq("id", id).eq("apartment_id", apartmentId).select("id"));
    revalidatePath(`/manage/apartments/${apartmentId}`);
    return "האדם סומן כפעיל.";
  });
}

export async function addNote(_p: State, fd: FormData): Promise<State> {
  return run([], async () => {
    const u = await admin();
    const supabase = createClient();
    const type = s(fd, "entity_type");
    const entityId = s(fd, "entity_id");
    const note = s(fd, "note");
    if (!["apartment", "resident"].includes(type) || !entityId) throw new Error("שיוך לא תקין");
    if (!note) throw new Error("ההערה ריקה");
    must(await supabase.from("internal_notes").insert({ building_id: u.building_id, entity_type: type, entity_id: entityId, note, created_by: u.id }).select("id"));
    revalidatePath(s(fd, "return_path") || "/manage");
    return "ההערה הפנימית נשמרה (גלויה לוועד בלבד).";
  });
}

// ---------- fees ----------

export async function createTariff(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/fees", "/payments"], async () => {
    await admin();
    const supabase = createClient();
    const amount = num(fd, "amount");
    const month = s(fd, "from_month"); // YYYY-MM
    if (!amount || amount <= 0) throw new Error("יש להזין סכום חודשי חיובי");
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("יש לבחור חודש תחילת תוקף");
    const scope = s(fd, "scope") === "selected" ? "selected" : "all";
    const apartmentIds = fd.getAll("apartment_ids").map(String).filter(Boolean);
    if (scope === "selected" && !apartmentIds.length) throw new Error("לא נבחרו דירות");
    const reason = s(fd, "reason");
    if (reason.length < 2) throw new Error("יש להזין סיבה");
    const { data, error } = await supabase.rpc("create_fee_tariff", {
      p_amount: amount,
      p_effective_from: `${month}-01`,
      p_scope: scope,
      p_apartment_ids: scope === "selected" ? apartmentIds : null,
      p_reason: reason,
      p_key: keyOf(fd),
    });
    if (error) throw new Error(error.message);
    return data?.status === "duplicate" ? "התעריף כבר נשמר (שמירה כפולה נמנעה)." : "התעריף נשמר. חיובים שכבר נוצרו לא שונו.";
  });
}

export async function addAdjustment(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/fees", "/payments"], async () => {
    await admin();
    const supabase = createClient();
    const amount = num(fd, "amount");
    if (!amount || amount <= 0) throw new Error("יש להזין סכום חיובי");
    const kind = s(fd, "kind") === "charge" ? 1 : -1;
    const { data, error } = await supabase.rpc("add_fee_adjustment", {
      p_apartment: s(fd, "apartment_id"),
      p_year: num(fd, "year"),
      p_month: num(fd, "month"),
      p_amount: amount * kind,
      p_reason: s(fd, "reason"),
      p_key: keyOf(fd),
    });
    if (error) throw new Error(error.message);
    return data?.status === "duplicate" ? "כבר נשמר." : kind === -1 ? "הזיכוי נרשם." : "החיוב הנוסף נרשם.";
  });
}

export async function voidAdjustment(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/fees", "/payments"], async () => {
    await admin();
    const supabase = createClient();
    const { error } = await supabase.rpc("void_fee_adjustment", { p_id: s(fd, "id"), p_reason: s(fd, "reason") });
    if (error) throw new Error(error.message);
    return "הרישום בוטל (נשמר ביומן).";
  });
}

export async function generateCharges(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/fees", "/payments", "/dashboard"], async () => {
    await admin();
    const supabase = createClient();
    const { data, error } = await supabase.rpc("generate_month_charges", { p_year: num(fd, "year"), p_month: num(fd, "month") });
    if (error) throw new Error(error.message);
    const undef = Number(data?.undefined ?? 0);
    return `נוצרו ${data?.created ?? 0} חיובים.` + (undef ? ` ${undef} דירות נשארו "לא הוגדר" כי אין להן תעריף לחודש זה.` : "");
  });
}

export async function recordFeePayment(_p: State, fd: FormData): Promise<State> {
  return run(["/payments", "/finances", "/dashboard"], async () => {
    const u = await admin();
    const supabase = createClient();
    const amount = num(fd, "amount");
    if (!amount || amount <= 0) throw new Error("יש להזין סכום חיובי");
    const aptId = s(fd, "apartment_id");
    const year = num(fd, "year");
    const month = num(fd, "month");
    const { data: apt } = await supabase.from("apartments").select("apartment_number").eq("id", aptId).eq("building_id", u.building_id).maybeSingle();
    if (!apt) throw new Error("הדירה לא נמצאה");
    const { data, error } = await supabase.rpc("create_transaction", {
      p_type: "income",
      p_date: s(fd, "date") || new Date().toISOString().slice(0, 10),
      p_amount: amount,
      p_description: `ועד בית - דירה ${apt.apartment_number} - ${month}/${year}`,
      p_category: null,
      p_supplier: null,
      p_apartment: aptId,
      p_fee_year: year,
      p_fee_month: month,
      p_notes: s(fd, "notes") || null,
      p_payment_method: s(fd, "method") || null,
      p_key: keyOf(fd),
    });
    if (error) throw new Error(error.message);
    return data?.status === "duplicate" ? "התשלום כבר נרשם (שמירה כפולה נמנעה)." : "התשלום נרשם, והוא נכלל גם בקופה.";
  });
}

// ---------- transactions ----------

export async function addTransactionAction(_p: State, fd: FormData): Promise<State> {
  return run(["/finances", "/dashboard"], async () => {
    await admin();
    const supabase = createClient();
    const type = s(fd, "type") === "income" ? "income" : "expense";
    const amount = num(fd, "amount");
    if (!amount || amount <= 0) throw new Error("יש להזין סכום חיובי");
    const date = s(fd, "date");
    if (!date) throw new Error("יש לבחור תאריך");
    const { data, error } = await supabase.rpc("create_transaction", {
      p_type: type,
      p_date: date,
      p_amount: amount,
      p_description: s(fd, "description") || null,
      p_category: s(fd, "category_id") || null,
      p_supplier: s(fd, "supplier_id") || null,
      p_apartment: null,
      p_fee_year: null,
      p_fee_month: null,
      p_notes: s(fd, "notes") || null,
      p_payment_method: null,
      p_key: keyOf(fd),
    });
    if (error) throw new Error(error.message);
    return data?.status === "duplicate" ? "התנועה כבר נשמרה (שמירה כפולה נמנעה)." : "התנועה נשמרה.";
  });
}

export async function correctTransaction(_p: State, fd: FormData): Promise<State> {
  return run(["/finances", "/payments", "/dashboard"], async () => {
    await admin();
    const supabase = createClient();
    const { error } = await supabase.rpc("correct_transaction", {
      p_id: s(fd, "id"),
      p_expected_version: num(fd, "row_version"),
      p_date: s(fd, "date"),
      p_amount: num(fd, "amount"),
      p_description: s(fd, "description") || null,
      p_category: s(fd, "category_id") || null,
      p_supplier: s(fd, "supplier_id") || null,
      p_notes: s(fd, "notes") || null,
      p_reason: s(fd, "reason"),
    });
    if (error) throw new Error(error.message);
    return "התנועה תוקנה, והערך הקודם נשמר ביומן.";
  });
}

export async function voidTransaction(_p: State, fd: FormData): Promise<State> {
  return run(["/finances", "/payments", "/dashboard"], async () => {
    await admin();
    const supabase = createClient();
    const { error } = await supabase.rpc("void_transaction", {
      p_id: s(fd, "id"),
      p_expected_version: num(fd, "row_version"),
      p_reason: s(fd, "reason"),
    });
    if (error) throw new Error(error.message);
    return "התנועה בוטלה ולא נכללת עוד ביתרה. הרישום נשמר ביומן.";
  });
}

// ---------- suppliers ----------

export async function saveSupplier(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/suppliers", "/finances"], async () => {
    const u = await admin();
    const supabase = createClient();
    const id = s(fd, "id");
    const name = s(fd, "name");
    if (!name) throw new Error("חובה להזין שם ספק");
    const payload = {
      name,
      phone: s(fd, "phone") || null,
      field: s(fd, "field") || null,
      monthly_cost: num(fd, "monthly_cost"),
      contract_start: s(fd, "contract_start") || null,
      contract_end: s(fd, "contract_end") || null,
      contract_url: s(fd, "contract_url") || null,
    };
    if (id) {
      const data = must(await supabase.from("suppliers").update({ ...payload, row_version: num(fd, "row_version") }).eq("id", id).eq("building_id", u.building_id).select("id"));
      if (!data?.length) throw new Error("הספק לא נמצא");
      return "הספק עודכן.";
    }
    must(await supabase.from("suppliers").insert({ ...payload, building_id: u.building_id }).select("id"));
    return "הספק נוסף.";
  });
}

// ---------- announcements / projects / requests ----------

export async function saveAnnouncement(_p: State, fd: FormData): Promise<State> {
  return run(["/announcements"], async () => {
    const u = await admin();
    const supabase = createClient();
    const title = s(fd, "title");
    const body = s(fd, "body");
    if (!title || !body) throw new Error("חובה להזין כותרת ותוכן");
    const data = must(
      await supabase
        .from("announcements")
        .update({ title, body, is_important: fd.get("is_important") === "on", row_version: num(fd, "row_version") })
        .eq("id", s(fd, "id"))
        .eq("building_id", u.building_id)
        .select("id")
    );
    if (!data?.length) throw new Error("ההודעה לא נמצאה");
    return "ההודעה עודכנה.";
  });
}

export async function saveProject(_p: State, fd: FormData): Promise<State> {
  return run(["/projects"], async () => {
    const u = await admin();
    const supabase = createClient();
    const title = s(fd, "title");
    if (!title) throw new Error("חובה להזין שם");
    const data = must(
      await supabase
        .from("projects")
        .update({
          title,
          description: s(fd, "description") || null,
          status: s(fd, "status"),
          estimated_cost: num(fd, "estimated_cost"),
          funded_so_far: num(fd, "funded_so_far") ?? 0,
          target_date: s(fd, "target_date") || null,
          updated_at: new Date().toISOString(),
          row_version: num(fd, "row_version"),
        })
        .eq("id", s(fd, "id"))
        .eq("building_id", u.building_id)
        .select("id")
    );
    if (!data?.length) throw new Error("התוכנית לא נמצאה");
    return "התוכנית עודכנה.";
  });
}

export async function saveRequest(_p: State, fd: FormData): Promise<State> {
  return run(["/requests"], async () => {
    const u = await admin();
    const supabase = createClient();
    const id = s(fd, "id");
    const status = s(fd, "status");
    const data = must(
      await supabase
        .from("requests")
        .update({
          title: s(fd, "title"),
          description: s(fd, "description") || null,
          category: s(fd, "category") || null,
          status,
          updated_at: new Date().toISOString(),
          row_version: num(fd, "row_version"),
        })
        .eq("id", id)
        .eq("building_id", u.building_id)
        .select("id")
    );
    if (!data?.length) throw new Error("הפנייה לא נמצאה");
    if (s(fd, "prev_status") !== status || s(fd, "comment")) {
      await supabase.from("request_updates").insert({ request_id: id, status, comment: s(fd, "comment") || null, updated_by: u.id });
    }
    return "הפנייה עודכנה.";
  });
}

// ---------- roles ----------

export async function changeUserRole(_p: State, fd: FormData): Promise<State> {
  return run(["/manage/users"], async () => {
    await admin();
    const supabase = createClient();
    const role = s(fd, "role");
    if (!["resident", "admin"].includes(role)) throw new Error("תפקיד לא תקין");
    const { error } = await supabase.rpc("set_user_role", { p_app_user: s(fd, "app_user_id"), p_role: role, p_reason: s(fd, "reason") });
    if (error) throw new Error(error.message);
    return "התפקיד עודכן ונרשם ביומן.";
  });
}
