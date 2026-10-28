import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { inp, lbl, ils } from "@/components/ui";
import DoneBanner from "@/components/DoneBanner";
import LinkTransactionsForm from "@/components/LinkTransactionsForm";
import { linkTransactionsToItem } from "@/lib/forecast-actions";
import { parseLinkFilters } from "@/lib/forecast-links";

export const dynamic = "force-dynamic";
const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("he-IL", { timeZone: "UTC" });
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const DONE: Record<string, (n: number) => string> = {
  linked: (n) => (n === 0 ? "לא היה מה לשנות: כל התנועות שנבחרו כבר משויכות להוצאה זו." : `${n} תנועות שויכו להוצאה הקבועה. סכומים ויתרות לא השתנו.`),
  unlinked: (n) => (n === 0 ? "לא היה מה לשנות: התנועות שנבחרו לא היו משויכות." : `השיוך בוטל ל־${n} תנועות. סכומים ויתרות לא השתנו.`),
};

export default async function LinkPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const me = await getCurrentAppUser();
  if (me?.role !== "admin") {
    return <div className="p-4 space-y-3"><h1 className="text-xl font-extrabold">שיוך הוצאות להוצאה קבועה</h1><p className="text-sm text-gray-700">העמוד זמין לוועד בלבד.</p><Link href="/forecast" className="text-brand-700 underline text-sm">חזרה לתחזית</Link></div>;
  }
  const supabase = createClient();
  const f = parseLinkFilters(searchParams);
  const [txRes, itemRes] = await Promise.all([
    supabase.from("transactions").select("id, date, amount, description, category_id, forecast_item_id, created_at, categories(name), suppliers(name), forecast_items:forecast_item_id(name)")
      .eq("building_id", me.building_id).eq("type", "expense").is("voided_at", null).order("date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("forecast_items").select("id, name, supplier, is_active").eq("building_id", me.building_id).order("is_active", { ascending: false }).order("name"),
  ]);
  const all = (txRes.data ?? []) as any[];
  const items = (itemRes.data ?? []) as any[];
  const cats = new Map<string, string>();
  for (const t of all) if (t.category_id && t.categories?.name) cats.set(t.category_id, t.categories.name);
  const words = norm(f.q).split(" ").filter(Boolean);
  const rows = all.filter((t) => {
    if (f.show === "unlinked" && t.forecast_item_id) return false;
    if (f.show === "linked" && !t.forecast_item_id) return false;
    if (f.cat && (f.cat === "none" ? t.category_id : t.category_id !== f.cat)) return false;
    const hay = norm([t.description, t.categories?.name, t.suppliers?.name].filter(Boolean).join(" "));
    return words.every((w) => hay.includes(w));
  });
  const unlinkedTotal = all.filter((t) => !t.forecast_item_id).length;
  const doneRaw = String(Array.isArray(searchParams.done) ? searchParams.done[0] : searchParams.done ?? "");
  const [dk, dn] = doneRaw.split(".");
  const doneText = DONE[dk]?.(Number(dn) || 0);
  const keepQs = new URLSearchParams(Object.entries({ q: f.q, cat: f.cat, show: f.show === "unlinked" ? "" : f.show }).filter(([, v]) => v) as [string, string][]).toString();
  const keep: Record<string, string> = {}; if (f.q) keep.q = f.q; if (f.cat) keep.cat = f.cat; if (f.show !== "unlinked") keep.show = f.show;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">שיוך הוצאות להוצאה קבועה</h1>
        <Link href="/forecast" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">תחזית ←</Link>
      </div>
      {doneText && <DoneBanner text={doneText} keep={keepQs} path="/forecast/link" />}
      <div className="card text-sm space-y-1">
        <p>השיוך ידני: הוועד מסמן אילו תנועות שייכות לאיזו הוצאה קבועה. המערכת לא משייכת לפי סכום, קטגוריה, ספק או מילים בתיאור, ולכן חשמל הבניין וחשמל החניון (או תחזוקת מעלית ובדיקת מעלית) לא מתערבבים.</p>
        <p className="text-gray-600">השיוך משנה רק את ההיסטוריה המוצגת בתחזית. אין שינוי בתנועות, בסכומים, ביתרת הקופה או בתחזית, והוא נרשם ביומן השינויים. אפשר לבטל שיוך בכל עת.</p>
        <p className="text-gray-600">הוצאות פעילות שטרם שויכו: <b>{unlinkedTotal}</b> מתוך {all.length}.</p>
      </div>
      <form method="get" action="/forecast/link" className="card space-y-2" data-form="link-filter">
        <label className={lbl} htmlFor="l-q">חיפוש בתיאור, בקטגוריה או בספק</label>
        <input id="l-q" name="q" type="search" defaultValue={f.q} className={inp} maxLength={100} placeholder="למשל: חשמל חניון" />
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lbl} htmlFor="l-cat">קטגוריה</label>
            <select id="l-cat" name="cat" defaultValue={f.cat} className={inp}><option value="">הכל</option>{Array.from(cats.entries()).sort((a, b) => a[1].localeCompare(b[1], "he")).map(([id, n]) => <option key={id} value={id}>{n}</option>)}<option value="none">ללא קטגוריה</option></select></div>
          <div><label className={lbl} htmlFor="l-show">הצג</label>
            <select id="l-show" name="show" defaultValue={f.show} className={inp}><option value="unlinked">רק שטרם שויכו</option><option value="linked">רק משויכות</option><option value="all">הכל</option></select></div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-lg bg-gray-800 text-white text-sm py-2.5 min-h-[44px]">החל</button>
          {(f.q || f.cat || f.show !== "unlinked") && <Link href="/forecast/link" className="flex-1 text-center rounded-lg border border-gray-300 text-sm py-2.5 min-h-[44px] inline-flex items-center justify-center">נקה</Link>}
        </div>
      </form>
      <div className="card">
        <p className="text-sm font-semibold mb-1" data-v="shown">מוצגות {rows.length} הוצאות</p>
        <LinkTransactionsForm action={linkTransactionsToItem} keep={keep} items={items.map((i) => ({ id: i.id, label: `${i.name}${i.supplier ? ` · ${i.supplier}` : ""}${i.is_active ? "" : " (הופסק)"}` }))}>
          {!rows.length ? (
            <p data-state="no-results" className="text-sm text-gray-600 py-3">אין הוצאות שמתאימות לסינון.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((t) => (
                <li key={t.id} id={`r-${t.id}`} className="py-1">
                  <label className="flex items-start gap-3 py-2 min-h-[44px] cursor-pointer">
                    <input type="checkbox" name="tx" value={t.id} className="h-5 w-5 mt-1 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold break-words">{t.description ?? t.categories?.name ?? "ללא תיאור"}</span>
                      <span className="block text-xs text-gray-500">{fmt(t.date)}{t.categories?.name ? ` · ${t.categories.name}` : ""}{t.suppliers?.name ? ` · ${t.suppliers.name}` : ""}</span>
                      {t.forecast_items?.name && <span className="block text-xs text-brand-700">משויכת: {t.forecast_items.name}</span>}
                    </span>
                    <span className="font-bold tabular-nums text-red-700 whitespace-nowrap" dir="ltr">{ils(t.amount)}</span>
                  </label>
                  <Link href={`/finances#tx-${t.id}`} className="text-xs text-brand-700 underline ps-8 inline-flex items-center min-h-[32px]">לתנועה המקורית</Link>
                </li>
              ))}
            </ul>
          )}
        </LinkTransactionsForm>
      </div>
    </div>
  );
}
