import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { ActionForm, SubmitButton } from "@/components/forms";
import { saveGapDecision, voidGapDecision } from "@/lib/collection-actions";
import { BASIS_LABELS } from "@/lib/allocations";
import { userNameMap, type AuditEntry } from "@/lib/audit";
import AuditList from "@/components/AuditList";
import DoneBanner from "@/components/DoneBanner";
import { inp, lbl, ils, monthName } from "@/components/ui";
import {
  coverageSummary, decisionRoom, fromAg, groupByApartment, monthRange, overallTotals, resolvePeriod, ymKey,
  type MonthStatus, type StatusRow, type Totals,
} from "@/lib/collection-status";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SP = { apt?: string; from?: string; to?: string; all?: string; done?: string };
const sel = "w-full rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white min-h-[44px]";
const money = (ag: number) => ils(fromAg(ag));
const dateHe = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("he-IL") : "—");

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="card py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-extrabold ${tone ?? ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function Summary({ t, title }: { t: Totals; title?: string }) {
  return (
    <div className="space-y-2">
      {title && <h2 className="font-bold">{title}</h2>}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="חיוב לתקופה" value={money(t.chargesAg)} hint="כולל התאמות וזיכויים" />
        <Stat label="תשלומים משויכים" value={money(t.paidAg)} hint="ישיר + שיוך מהכנסות" />
        <Stat label="הפחתות שאושרו" value={money(t.reductionAg)} tone="text-sky-800" hint="אינן תשלום" />
        <Stat label="חוב מאומת" value={money(t.verifiedAg)} tone="text-red-700" hint="אושר על ידי הוועד" />
        <div className="col-span-2"><Stat label="פער לבירור" value={money(t.clarifyAg)} tone="text-amber-800" hint="אינו חוב מאומת עד החלטת ועד" /></div>
      </div>
      {t.surplusAg > 0 && <p className="text-xs text-gray-600">תשלומים מעל החיוב בחודשים מסוימים: {money(t.surplusAg)} (מוצג בנפרד, אינו מקוזז מחודשים אחרים).</p>}
      {t.excessAg > 0 && <p className="text-xs text-red-700">יש החלטות בסכום של {money(t.excessAg)} שחורג מהפער הפתוח. הן אינן נספרות.</p>}
    </div>
  );
}

export default async function CollectionPage({ searchParams }: { searchParams: SP }) {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-xl font-extrabold">מצב גבייה וחובות</h1>
        <div className="card text-sm">המסך זמין לוועד בלבד.</div>
      </div>
    );
  }
  const supabase = createClient();

  const [{ data: aptRows }, { data: cov }, { data: wide }, { data: srcs }] = await Promise.all([
    supabase.from("apartments").select("id, floor, apartment_number").eq("building_id", appUser.building_id),
    supabase.rpc("bank_coverage"),
    // הטווח נגזר מהנתונים: קוראים את כל התקופה ואז מסננים (אותה שורה מזינה סיכום ופירוט).
    supabase.rpc("collection_status", { p_from_year: 2020, p_from_month: 1, p_to_year: 2100, p_to_month: 12 }),
    supabase.rpc("income_sources"),
  ]);
  const apts = [...(aptRows ?? [])].sort((a: any, b: any) => Number(a.apartment_number) - Number(b.apartment_number));
  const aptNo = new Map<string, string>(apts.map((a: any) => [a.id, String(a.apartment_number)]));
  const rows = (wide ?? []) as StatusRow[];
  const range = monthRange(rows);
  const aptFilter = apts.some((a: any) => a.id === searchParams.apt) ? searchParams.apt! : null;
  const showAll = searchParams.all === "1";
  const period = range ? resolvePeriod(range, searchParams.from, searchParams.to) : null;
  const groups = period ? groupByApartment(rows, period, aptFilter) : [];
  groups.sort((a, b) => Number(aptNo.get(a.apartment_id)) - Number(aptNo.get(b.apartment_id)));
  const overall = overallTotals(groups);
  const verifiedGroups = groups.filter((g) => g.totals.verifiedAg > 0);
  const clarifyGroups = groups.filter((g) => g.totals.clarifyAg > 0);

  // פירוט מקורות התשלום והחלטות ליחידות שמוצגות
  const aptIds = groups.map((g) => g.apartment_id);
  const [{ data: allocs }, { data: direct }, { data: decisions }] = aptIds.length
    ? await Promise.all([
        supabase
          .from("payment_allocations")
          .select("apartment_id, fee_year, fee_month, amount, apartment_basis, months_basis, basis_note, transactions:transaction_id(date, description)")
          .eq("kind", "fee").is("voided_at", null).in("apartment_id", aptIds),
        supabase
          .from("transactions")
          .select("source_apartment_id, fee_year, fee_month, amount, date, description, payment_method, notes")
          .eq("building_id", appUser.building_id).eq("type", "income").is("voided_at", null).not("fee_year", "is", null).in("source_apartment_id", aptIds),
        supabase
          .from("fee_gap_decisions")
          .select("id, apartment_id, year, month, kind, amount, reason, reported_on, created_at, created_by, updated_at, updated_by, voided_at")
          .eq("building_id", appUser.building_id).is("voided_at", null).in("apartment_id", aptIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const allocBy = new Map<string, any[]>();
  for (const a of allocs ?? []) { const k = `${a.apartment_id}|${a.fee_year}|${a.fee_month}`; (allocBy.get(k) ?? allocBy.set(k, []).get(k)!).push(a); }
  const directBy = new Map<string, any[]>();
  for (const t of direct ?? []) { const k = `${t.source_apartment_id}|${t.fee_year}|${t.fee_month}`; (directBy.get(k) ?? directBy.set(k, []).get(k)!).push(t); }
  const decBy = new Map<string, any[]>();
  for (const d of decisions ?? []) { const k = `${d.apartment_id}|${d.year}|${d.month}`; (decBy.get(k) ?? decBy.set(k, []).get(k)!).push(d); }

  // היסטוריית שינויים בהחלטות של הדירות המוצגות
  const decIds = (decisions ?? []).map((d: any) => d.id);
  const { data: allDec } = aptIds.length
    ? await supabase.from("fee_gap_decisions").select("id, apartment_id, year, month").eq("building_id", appUser.building_id).in("apartment_id", aptIds)
    : { data: [] as any[] };
  const metaById = new Map<string, any>((allDec ?? []).map((d: any) => [d.id, d]));
  const { data: log } = (allDec ?? []).length
    ? await supabase.from("audit_log").select("*").eq("entity_type", "fee_gap_decisions").in("entity_id", (allDec ?? []).map((d: any) => d.id)).order("created_at", { ascending: false }).limit(300)
    : { data: [] as any[] };
  const names = await userNameMap(supabase, [
    ...(decisions ?? []).flatMap((d: any) => [d.created_by, d.updated_by]),
    ...(log ?? []).map((l: any) => l.user_id),
  ]);
  const logBy = new Map<string, AuditEntry[]>();
  for (const l of (log ?? []) as any[]) {
    const meta = metaById.get(l.entity_id);
    if (!meta) continue;
    const k = `${meta.apartment_id}|${meta.year}|${meta.month}`;
    (logBy.get(k) ?? logBy.set(k, []).get(k)!).push(l as AuditEntry);
  }
  void decIds;

  const unallocated = ((srcs ?? []) as any[]).filter((s) => Number(s.available) > 0.004);
  const unallocatedAg = unallocated.reduce((s, x) => s + Math.round(Number(x.available) * 100), 0);

  const [doneCode, doneKind] = String(searchParams.done ?? "").split(".");
  const kindLabel = doneKind === "reduction" ? "הפחתה שאושרה" : "חוב מאומת";
  const doneText =
    doneCode === "created" ? `ההחלטה נשמרה (${kindLabel}). לא נוצרה הכנסה ולא שונו תשלומים או חיובים.`
    : doneCode === "updated" ? `ההחלטה עודכנה (${kindLabel}) והשינוי נשמר ביומן.`
    : doneCode === "voided" ? "ההחלטה בוטלה (נשמר ביומן). הפער חזר להיות לבירור."
    : null;
  const keepParams = new URLSearchParams();
  if (aptFilter) keepParams.set("apt", aptFilter);
  if (searchParams.from) keepParams.set("from", searchParams.from);
  if (searchParams.to) keepParams.set("to", searchParams.to);
  if (showAll) keepParams.set("all", "1");
  const keep = keepParams.toString();
  const cs = coverageSummary(cov?.[0] ?? null);
  const c0: any = cov?.[0] ?? null;

  const monthOptions: { v: string; label: string }[] = [];
  if (range) {
    for (let i = range.from.year * 12 + range.from.month - 1; i <= range.to.year * 12 + range.to.month - 1; i++) {
      const y = Math.floor(i / 12); const m = (i % 12) + 1;
      monthOptions.push({ v: ymKey(y, m), label: `${monthName(m)} ${y}` });
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">מצב גבייה וחובות</h1>
        <Link href="/manage" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">ניהול ←</Link>
      </div>
      {doneText && <DoneBanner path="/manage/collection" keep={keep} text={doneText} />}

      <div className="card text-sm space-y-1">
        <p><b>פער אינו חוב.</b> הפער הוא ההפרש בין החיוב לחודש (כולל התאמות) לבין התשלומים שנרשמו או שויכו. כל פער נשאר <b>״לבירור״</b> עד שהוועד מתעד החלטה.</p>
        <p className="text-gray-600">הפחתה שאושרה אינה תשלום ואינה יוצרת הכנסה. יתרת הפתיחה של חשבון הוועד אינה חלק מחובות הדיירים. העמוד לקריאה ולתיעוד החלטות בלבד: הוא אינו משנה תשלומים, חיובים, התאמות או שיוכים.</p>
      </div>

      <section className="card text-sm space-y-1" aria-label="כיסוי תנועות הבנק">
        <h2 className="font-bold">כיסוי תנועות הבנק</h2>
        <div>{cs.text}{cs.known ? "" : ""}</div>
        {c0?.covered_from && <div className="text-xs text-gray-600">תחילת הכיסוי: {dateHe(c0.covered_from)}</div>}
        {c0?.last_import_at && <div className="text-xs text-gray-600">מועד הרישום של הייבוא האחרון: {new Date(c0.last_import_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}{c0.batch_source === "seed" ? " (תיעוד ראשוני לפי דפי הבנק)" : ""}</div>}
        {cs.known && cs.manualAfter && <div className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">{cs.manualAfter}. רשומות אלה הוזנו ידנית ואינן מרחיבות את כיסוי הבנק.</div>}
        <div className="text-xs text-gray-500">תאריך הכיסוי הוא תאריך התנועה האחרונה בייבוא מהבנק, ולא מועד הייבוא ולא תאריך רשומה ידנית.</div>
      </section>

      <form method="get" className="card space-y-2" aria-label="סינון">
        <h2 className="font-bold">סינון</h2>
        <div><label className={lbl} htmlFor="f-apt">דירה</label>
          <select id="f-apt" name="apt" className={sel} defaultValue={aptFilter ?? ""}>
            <option value="">כל הדירות</option>
            {apts.map((a: any) => <option key={a.id} value={a.id}>דירה {a.apartment_number}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lbl} htmlFor="f-from">מחודש</label>
            <select id="f-from" name="from" className={sel} defaultValue={period ? ymKey(period.from.year, period.from.month) : ""}>
              {monthOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select></div>
          <div><label className={lbl} htmlFor="f-to">עד חודש</label>
            <select id="f-to" name="to" className={sel} defaultValue={period ? ymKey(period.to.year, period.to.month) : ""}>
              {monthOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select></div>
        </div>
        <label className="flex items-center gap-2 text-sm min-h-[44px]"><input type="checkbox" name="all" value="1" defaultChecked={showAll} className="w-5 h-5" /> הצג גם חודשים ללא פער</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="submit" className="btn-primary text-sm py-2.5 min-h-[44px]">הצג</button>
          <Link href="/manage/collection" className="rounded-lg border border-gray-300 text-sm min-h-[44px] flex items-center justify-center">איפוס</Link>
        </div>
      </form>

      {!period ? (
        <div className="card text-sm">אין עדיין חיובים חודשיים במערכת.</div>
      ) : (
        <>
          <div className="text-xs text-gray-600">תקופה: {monthName(period.from.month)} {period.from.year} – {monthName(period.to.month)} {period.to.year}{aptFilter ? ` · דירה ${aptNo.get(aptFilter)}` : " · כל הדירות"}</div>
          <Summary t={overall} title="סיכום כללי" />

          <section className="card space-y-2" aria-label="חובות מאומתים">
            <h2 className="font-bold">חובות מאומתים</h2>
            {verifiedGroups.length === 0 ? <p className="text-sm text-gray-500">לא תועדו חובות מאומתים בתקופה זו.</p> : (
              <ul className="divide-y divide-gray-100 text-sm">
                {verifiedGroups.map((g) => <li key={g.apartment_id} className="py-2 flex justify-between"><span>דירה {aptNo.get(g.apartment_id)}</span><b className="text-red-700">{money(g.totals.verifiedAg)}</b></li>)}
                <li className="py-2 flex justify-between font-bold"><span>סך הכול</span><span>{money(overall.verifiedAg)}</span></li>
              </ul>
            )}
          </section>

          <section className="card space-y-2" aria-label="פערים לבירור">
            <h2 className="font-bold">פערים לבירור</h2>
            <p className="text-xs text-gray-600">אין להסיק מהם חוב. ייתכן שתשלום נרשם בחודש אחר, טרם שויך או הוסכם לגביו משהו.</p>
            {clarifyGroups.length === 0 ? <p className="text-sm text-gray-500">אין פערים לבירור בתקופה זו.</p> : (
              <ul className="divide-y divide-gray-100 text-sm">
                {clarifyGroups.map((g) => <li key={g.apartment_id} className="py-2 flex justify-between"><span>דירה {aptNo.get(g.apartment_id)} · {(() => { const n = g.months.filter((m) => m.clarifyAg > 0).length; return n === 1 ? "חודש אחד" : `${n} חודשים`; })()}</span><b className="text-amber-800">{money(g.totals.clarifyAg)}</b></li>)}
                <li className="py-2 flex justify-between font-bold"><span>סך הכול</span><span>{money(overall.clarifyAg)}</span></li>
              </ul>
            )}
          </section>

          <section className="space-y-3" aria-label="לפי דירה">
            <h2 className="font-bold">לפי דירה</h2>
            {groups.map((g) => {
              const t = g.totals;
              const list = showAll ? g.months : g.months.filter((m) => m.shortfallAg > 0 || m.surplusAg > 0 || m.reductionAg > 0 || m.verifiedAg > 0);
              return (
                <details key={g.apartment_id} className="card" data-apt={aptNo.get(g.apartment_id)}>
                  <summary className="cursor-pointer min-h-[44px] flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="font-bold">דירה {aptNo.get(g.apartment_id)}</span>
                    <span className="text-xs text-gray-600">לבירור <b className="text-amber-800">{money(t.clarifyAg)}</b>{t.verifiedAg > 0 && <> · חוב מאומת <b className="text-red-700">{money(t.verifiedAg)}</b></>}</span>
                  </summary>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm mt-2">
                    <dt className="text-gray-500">חיוב לתקופה</dt><dd className="text-end">{money(t.chargesAg)}</dd>
                    <dt className="text-gray-500">תשלומים משויכים</dt><dd className="text-end">{money(t.paidAg)}</dd>
                    <dt className="text-gray-500">הפחתות שאושרו</dt><dd className="text-end">{money(t.reductionAg)}</dd>
                    <dt className="text-gray-500">חוב מאומת</dt><dd className="text-end">{money(t.verifiedAg)}</dd>
                    <dt className="text-gray-500">פער לבירור</dt><dd className="text-end font-semibold">{money(t.clarifyAg)}</dd>
                    {t.surplusAg > 0 && (<><dt className="text-gray-500">תשלום מעל החיוב</dt><dd className="text-end">{money(t.surplusAg)}</dd></>)}
                  </dl>
                  <div className="mt-3 space-y-2">
                    {list.length === 0 && <p className="text-sm text-gray-500">אין חודשים עם פער בתקופה זו.</p>}
                    {list.map((m) => <MonthBlock key={m.key} m={m} apt={aptNo.get(m.apartment_id) ?? ""} allocs={allocBy.get(m.key) ?? []} direct={directBy.get(m.key) ?? []} decs={decBy.get(m.key) ?? []} log={logBy.get(m.key) ?? []} names={names} filters={{ apt: aptFilter ?? "", from: searchParams.from ?? "", to: searchParams.to ?? "", all: showAll ? "1" : "" }} />)}
                  </div>
                </details>
              );
            })}
          </section>
        </>
      )}

      <section className="card space-y-2" aria-label="כספים שהתקבלו וטרם שויכו">
        <h2 className="font-bold">כספים שהתקבלו וטרם שויכו</h2>
        <p className="text-xs text-gray-600">הכנסות שנרשמו בכספים ועדיין יש בהן יתרה שלא שויכה לדירה או לחודש. הן כבר נספרות כהכנסה בקופה, אינן מקוזזות אוטומטית מחוב של דירה, ואינן נרשמות מחדש כהכנסה. חלקן אולי אינן דמי ועד כלל. לשיוך: <Link href="/payments/allocate" className="text-brand-700 font-semibold underline">שיוך הכנסה</Link>.</p>
        {unallocated.length === 0 ? <p className="text-sm text-gray-500">אין כספים שטרם שויכו.</p> : (
          <ul className="divide-y divide-gray-100 text-sm">
            {unallocated.map((s) => (
              <li key={s.id} className="py-2">
                <div className="flex justify-between gap-2"><span className="font-semibold break-words min-w-0">{s.description || "ללא תיאור"}</span><b className="whitespace-nowrap">{ils(Number(s.available))}</b></div>
                <div className="text-xs text-gray-600">התקבל ב־{dateHe(s.date)} · סכום מקורי {ils(Number(s.amount))}{Number(s.allocated) > 0 ? ` · שויך ${ils(Number(s.allocated))}` : ""}</div>
              </li>
            ))}
            <li className="py-2 flex justify-between font-bold"><span>סך הכול טרם שויך</span><span>{money(unallocatedAg)}</span></li>
          </ul>
        )}
      </section>
    </div>
  );
}

function MonthBlock({ m, apt, allocs, direct, decs, log, names, filters }: {
  m: MonthStatus; apt: string; allocs: any[]; direct: any[]; decs: any[]; log: AuditEntry[]; names: Map<string, string>;
  filters: { apt: string; from: string; to: string; all: string };
}) {
  const red = decs.find((d) => d.kind === "reduction");
  const ver = decs.find((d) => d.kind === "verified_debt");
  const statusLabel = m.shortfallAg === 0 ? (m.surplusAg > 0 ? "שולם, עם תשלום עודף" : "שולם במלואו") : m.paidAg > 0 ? "תשלום חלקי" : "טרם נרשם תשלום";
  return (
    <details className="rounded-lg border border-gray-200 px-3" data-month={`${m.year}-${m.month}`}>
      <summary className="cursor-pointer min-h-[44px] flex flex-wrap items-center justify-between gap-x-3 text-sm">
        <span className="font-semibold">{monthName(m.month)} {m.year}</span>
        <span className="text-xs text-gray-600">{statusLabel}{m.clarifyAg > 0 && <> · לבירור <b className="text-amber-800">{money(m.clarifyAg)}</b></>}</span>
      </summary>
      <div className="pb-3 space-y-2 text-sm">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
          <dt className="text-gray-500">חיוב בסיס</dt><dd className="text-end">{money(m.baseAg)}</dd>
          {m.creditsAg !== 0 && (<><dt className="text-gray-500">זיכויים</dt><dd className="text-end">{money(m.creditsAg)}</dd></>)}
          {m.extrasAg !== 0 && (<><dt className="text-gray-500">חיובים נוספים</dt><dd className="text-end">{money(m.extrasAg)}</dd></>)}
          <dt className="text-gray-500">חיוב לחודש</dt><dd className="text-end font-semibold">{money(m.netAg)}</dd>
          <dt className="text-gray-500">שולם (ישיר)</dt><dd className="text-end">{money(m.directAg)}</dd>
          <dt className="text-gray-500">שויך מהכנסות</dt><dd className="text-end">{money(m.allocatedAg)}</dd>
          <dt className="text-gray-500">סך התשלומים</dt><dd className="text-end font-semibold">{money(m.paidAg)}</dd>
          <dt className="text-gray-500">פער פתוח</dt><dd className="text-end">{money(m.shortfallAg)}</dd>
          <dt className="text-gray-500">הפחתה שאושרה</dt><dd className="text-end">{money(m.reductionAg)}</dd>
          <dt className="text-gray-500">חוב מאומת</dt><dd className="text-end">{money(m.verifiedAg)}</dd>
          <dt className="text-gray-500">לבירור</dt><dd className="text-end font-semibold">{money(m.clarifyAg)}</dd>
          {m.surplusAg > 0 && (<><dt className="text-gray-500">תשלום מעל החיוב</dt><dd className="text-end">{money(m.surplusAg)}</dd></>)}
        </dl>
        {m.excessDecisionAg > 0 && <p className="text-xs text-red-700">החלטות בסכום {money(m.excessDecisionAg)} חורגות מהפער הפתוח ואינן נספרות.</p>}

        {(direct.length > 0 || allocs.length > 0) && (
          <div>
            <div className="text-xs font-semibold text-gray-700">מקורות התשלום</div>
            <ul className="text-xs text-gray-700 space-y-1">
              {direct.map((t, i) => <li key={`d${i}`}>{ils(Number(t.amount))} · {dateHe(t.date)} · רישום ישיר{t.description ? ` · ${t.description}` : ""}{t.notes ? ` · הערה: ${t.notes}` : ""}</li>)}
              {allocs.map((a, i) => (
                <li key={`a${i}`}>{ils(Number(a.amount))} · התקבל {dateHe(a.transactions?.date)}{a.transactions?.description ? ` · ${a.transactions.description}` : ""} · שיוך מהכנסה קיימת
                  <div className="text-gray-500">בסיס הדירה: {BASIS_LABELS[a.apartment_basis as keyof typeof BASIS_LABELS] ?? "—"} · בסיס החודשים: {BASIS_LABELS[a.months_basis as keyof typeof BASIS_LABELS] ?? "—"}{a.basis_note ? ` · ${a.basis_note}` : ""}</div></li>
              ))}
            </ul>
          </div>
        )}

        {[red, ver].filter(Boolean).map((d: any) => (
          <div key={d.id} className="rounded-lg bg-gray-50 p-2 space-y-1">
            <div className="font-semibold">{d.kind === "reduction" ? "הפחתה שאושרה" : "חוב מאומת"}: {ils(Number(d.amount))}</div>
            <div className="text-xs text-gray-700 break-words">סיבה: {d.reason}</div>
            <div className="text-xs text-gray-500">{d.reported_on ? `דווח ב־${dateHe(d.reported_on)} · ` : ""}תועד ב־{new Date(d.created_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })} · {d.created_by ? names.get(d.created_by) ?? "משתמש" : "המערכת, לפי דיווח הוועד"}</div>
            <ActionForm action={voidGapDecision} keepOnSuccess className="space-y-1">
              <input type="hidden" name="id" value={d.id} />
              {(["apt", "from", "to", "all"] as const).map((k) => <input key={k} type="hidden" name={`f_${k}`} value={filters[k]} />)}
              <input name="reason" aria-label="סיבת ביטול ההחלטה" className={inp} placeholder="סיבת ביטול ההחלטה (חובה)" required minLength={3} />
              <SubmitButton className="w-full rounded-lg border border-red-300 text-red-800 text-sm py-2.5 min-h-[44px]" confirmText="לבטל את ההחלטה? הפער יחזור להיות לבירור. נשמר ביומן.">בטל החלטה</SubmitButton>
            </ActionForm>
          </div>
        ))}

        {(m.shortfallAg > 0 || red || ver) && (
          <details className="border-t border-gray-100 pt-1">
            <summary className="text-xs text-brand-700 cursor-pointer min-h-[44px] flex items-center">תיעוד או עדכון החלטת ועד</summary>
            <ActionForm action={saveGapDecision} keepOnSuccess className="space-y-2 mt-1">
              <input type="hidden" name="apartment_id" value={m.apartment_id} />
              <input type="hidden" name="year" value={m.year} />
              <input type="hidden" name="month" value={m.month} />
              {(["apt", "from", "to", "all"] as const).map((k) => <input key={k} type="hidden" name={`f_${k}`} value={filters[k]} />)}
              <p className="text-xs text-gray-600">ברירת המחדל לכל פער היא ״לבירור״. תיעוד החלטה אינו תשלום, אינו יוצר הכנסה ואינו משנה חיובים או תשלומים. אם כבר קיימת החלטה מאותו סוג, היא תתעדכן והשינוי יישמר ביומן. פער פתוח לדירה {apt}: {money(m.shortfallAg)}.</p>
              <div><label className={lbl}>סוג ההחלטה</label>
                <select name="kind" className={sel} defaultValue={red && !ver ? "verified_debt" : "reduction"}>
                  <option value="reduction">הפחתה שאושרה (עד {money(decisionRoom(m, "reduction"))})</option>
                  <option value="verified_debt">חוב מאומת (עד {money(decisionRoom(m, "verified_debt"))})</option>
                </select></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>סכום (₪)</label><input name="amount" aria-label="סכום ההחלטה" inputMode="decimal" className={inp} required placeholder="0.00" /></div>
                <div><label className={lbl}>תאריך הדיווח (אם ידוע)</label><input name="reported_on" aria-label="תאריך הדיווח" type="date" className={inp} /></div>
              </div>
              <input name="reason" aria-label="סיבת ההחלטה" className={inp} placeholder="סיבה / אסמכתה (חובה)" required minLength={3} maxLength={500} />
              <SubmitButton confirmText="לשמור את ההחלטה? היא אינה תשלום ואינה משנה את הכספים.">שמור החלטה</SubmitButton>
            </ActionForm>
          </details>
        )}

        {log.length > 0 && (
          <details className="border-t border-gray-100 pt-1">
            <summary className="text-xs text-brand-700 cursor-pointer min-h-[44px] flex items-center">היסטוריית החלטות ({log.length})</summary>
            <AuditList entries={log} names={names} showEntity={false} />
          </details>
        )}
      </div>
    </details>
  );
}
