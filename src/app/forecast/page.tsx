import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { ActionForm, SubmitButton } from "@/components/forms";
import { inp, lbl, ils, monthName } from "@/components/ui";
import { addForecastOneOff, saveForecastItem, saveForecastSettings, setForecastItemActive, setForecastScenario, voidForecastOneOff } from "@/lib/forecast-actions";
import { groupByItem, type ItemHistory } from "@/lib/forecast-links";
import { forecastMonth, fromAgorot, nextThreeMonths, recurringTotalAgorot, toAgorot, type FeeGroup } from "@/lib/forecast";

export const dynamic = "force-dynamic";

const fmtDate = (d: string | null) => (d ? new Date(d + "T00:00:00Z").toLocaleDateString("he-IL", { timeZone: "UTC" }) : null);
const fmtTs = (d: string) => new Date(d).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
const KIND_LABELS: Record<string, string> = { recurring: "הוצאה קבועה", allocation: "הקצאה חודשית משוערת" };

export default async function ForecastPage() {
  const supabase = createClient();
  const me = await getCurrentAppUser();
  const isAdmin = me?.role === "admin";
  const months = nextThreeMonths();

  const [itemsRes, settingsRes, scenRes, oneOffRes, linkedRes, unlinkedRes, ...groupRes] = await Promise.all([
    supabase.from("forecast_items").select("*").eq("building_id", me?.building_id).order("is_active", { ascending: false }).order("monthly_estimate", { ascending: false }),
    supabase.from("forecast_settings").select("*").eq("building_id", me?.building_id).maybeSingle(),
    supabase.from("forecast_scenarios").select("fee_amount, non_paying, updated_at").eq("building_id", me?.building_id),
    supabase.from("forecast_one_offs").select("id, year, month, title, amount, note, voided_at, created_at").eq("building_id", me?.building_id).is("voided_at", null).order("year").order("month"),
    supabase.from("transactions").select("id, date, amount, description, forecast_item_id, created_at, voided_at").eq("building_id", me?.building_id).not("forecast_item_id", "is", null).is("voided_at", null),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("building_id", me?.building_id).eq("type", "expense").is("voided_at", null).is("forecast_item_id", null),
    ...months.map((m) => supabase.rpc("forecast_fee_groups", { p_year: m.year, p_month: m.month })),
  ]);
  const loadError = itemsRes.error || settingsRes.error || scenRes.error || oneOffRes.error || groupRes.find((g) => g.error)?.error;

  const histories = groupByItem((linkedRes.data ?? []) as any[]);
  const linksAvailable = !linkedRes.error; // אם העמודה אינה זמינה לא מציגים היסטוריה כאילו אין תשלומים
  const unlinkedCount = unlinkedRes.count ?? null;
  const items = (itemsRes.data ?? []).map((i: any) => ({ ...i, monthly_estimate: Number(i.monthly_estimate) }));
  const active = items.filter((i: any) => i.is_active);
  const stopped = items.filter((i: any) => !i.is_active);
  const settings: any = settingsRes.data;
  const refund = Number(settings?.libna4_refund ?? 0);
  const scenarios = (scenRes.data ?? []).map((s: any) => ({ fee_amount: Number(s.fee_amount), non_paying: s.non_paying }));
  const oneOffs = (oneOffRes.data ?? []).map((o: any) => ({ ...o, amount: Number(o.amount) }));
  const groupsByMonth: FeeGroup[][] = groupRes.map((g) => ((g.data ?? []) as any[]).map((r) => ({ fee_amount: r.fee_amount === null ? null : Number(r.fee_amount), apartment_count: r.apartment_count })));

  const calc = months.map((m, i) => forecastMonth({ groups: groupsByMonth[i], scenarios, items, oneOffs, refund, month: m }));
  const label = (m: { year: number; month: number }) => `${monthName(m.month)} ${m.year}`;
  const anyScenario = calc.some((c) => c.dues.reduction_agorot > 0);

  // Tariff groups across the three months (anonymous: tariff amount and size only).
  const groupAmounts = new Map<number, number>();
  groupsByMonth.forEach((gs) => gs.forEach((g) => { if (g.fee_amount !== null) groupAmounts.set(g.fee_amount, Math.max(groupAmounts.get(g.fee_amount) ?? 0, g.apartment_count)); }));
  const groupList = [...groupAmounts.entries()].sort((a, b) => a[0] - b[0]);
  const orphanScenarios = scenarios.filter((s: any) => s.non_paying > 0 && !groupAmounts.has(s.fee_amount));
  const lastUpdate = [...items.map((i: any) => i.updated_at), settings?.updated_at].filter(Boolean).sort().pop() as string | undefined;

  const row = (labelText: string, vals: (c: (typeof calc)[number]) => string, opts?: { bold?: boolean; sub?: boolean }) => (
    <tr className={opts?.bold ? "font-bold bg-gray-50" : ""}>
      <th scope="row" className={`text-right py-2 pe-2 font-medium ${opts?.sub ? "text-xs text-gray-600" : ""}`}>{labelText}</th>
      {calc.map((c) => <td key={`${c.month.year}-${c.month.month}`} className="text-left tabular-nums py-2 ps-2 whitespace-nowrap" dir="ltr">{vals(c)}</td>)}
    </tr>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">הוצאות קבועות ותחזית</h1>
        <Link href="/finances" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 font-semibold">כספים ←</Link>
      </div>

      <div className="card border-orange-300 bg-orange-50 text-sm space-y-1" role="note">
        <p className="font-bold">התחזית אינה יתרת בנק ואינה תנועות בפועל.</p>
        <p>אין כאן יתרת פתיחה ואין יתרת בנק חזויה. אלו אומדנים חודשיים לצורכי תכנון, לא לוח מועדי חיוב מדויק, ושום תנועה, חיוב או תשלום לא נוצרים מהעמוד הזה.</p>
      </div>
      {loadError && <p className="text-sm text-red-700" role="alert">לא ניתן לטעון חלק מהנתונים. רענן/י את העמוד ונסה/י שוב.</p>}

      <section className="card space-y-2" aria-labelledby="fc-title">
        <h2 id="fc-title" className="font-bold">תחזית לשלושת החודשים הבאים</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-600">
                <th scope="col" className="text-right py-2 pe-2 font-medium"><span className="sr-only">סעיף</span></th>
                {calc.map((c) => <th key={`${c.month.year}-${c.month.month}`} scope="col" className="text-left py-2 ps-2 font-semibold whitespace-nowrap">{label(c.month)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {row("דמי ועד צפויים", (c) => ils(fromAgorot(c.dues.expected_agorot)))}
              {anyScenario && row("מתוכם הפחתת תרחיש", (c) => (c.dues.reduction_agorot ? "−" + ils(fromAgorot(c.dues.reduction_agorot)) : "—"), { sub: true })}
              {row("החזר חשמל צפוי מליבנה 4", (c) => ils(fromAgorot(c.refund_agorot)))}
              {row("סך הכנסות צפויות", (c) => ils(fromAgorot(c.income_agorot)), { bold: true })}
              {row("הוצאות צפויות", (c) => ils(fromAgorot(c.expenses_agorot)))}
              {calc.some((c) => c.one_off_agorot > 0) && row("מתוכן הוצאה מיוחדת", (c) => (c.one_off_agorot ? ils(fromAgorot(c.one_off_agorot)) : "—"), { sub: true })}
              {row("הפרש (הכנסות פחות הוצאות)", (c) => ils(fromAgorot(c.diff_agorot)), { bold: true })}
            </tbody>
          </table>
        </div>
        <ul className="text-xs text-gray-600 list-disc pr-5 space-y-1">
          <li>דמי הוועד לפי התעריפים הקיימים התקפים לכל חודש, בגבייה מלאה אלא אם הוגדר תרחיש.</li>
          <li>החזר ליבנה 4 הוא החזר משתנה לפי צריכה ולא הכנסה קבועה מובטחת.</li>
          <li>לא נכללו טיפולי מאגר ומשאבות עתידיים (תדירותם אינה ידועה) ותיקונים בלתי צפויים, אלא אם נוספו כהוצאה מיוחדת.</li>
          <li>ההדברה ובדיקות המעלית כלולות באומדן החודשי כהקצאה, ולכן לא מוספות פעם נוספת.</li>
        </ul>
      </section>

      <section className="card space-y-2" aria-labelledby="exp-title">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="exp-title" className="font-bold">הוצאות קבועות (אומדן חודשי)</h2>
          <span className="font-extrabold tabular-nums" dir="ltr">{ils(fromAgorot(recurringTotalAgorot(active)))}</span>
        </div>
        <p className="text-xs text-gray-600">
          נתוני הפתיחה לפי דפי הבנק 1.12.2024–16.10.2026. הסכום מחושב מהשורות.{lastUpdate ? ` עודכן לאחרונה: ${fmtTs(lastUpdate)}.` : ""}
        </p>
        <p className="text-xs text-gray-600" data-note="links">
          ״כל התשלומים״ בכל סעיף מציג רק תשלומים ששויכו אליו ידנית על ידי הוועד, ולא התאמה אוטומטית. {unlinkedCount !== null ? `${unlinkedCount} הוצאות פעילות טרם שויכו לאף סעיף, ולכן הרשימה עדיין אינה בהכרח ההיסטוריה המלאה. ` : ""}
          {isAdmin && <Link href="/forecast/link" className="text-brand-700 underline font-semibold">שיוך הוצאות לסעיפים</Link>}
        </p>
        <ul className="divide-y divide-gray-100">
          {active.map((i: any) => (
            <li key={i.id} className="py-3 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{i.name}{i.supplier ? <span className="font-normal text-gray-600"> · {i.supplier}</span> : null}</div>
                  <div className="text-xs text-gray-600">{KIND_LABELS[i.kind]}</div>
                </div>
                <div className="font-bold tabular-nums whitespace-nowrap" dir="ltr">{ils(i.monthly_estimate)}</div>
              </div>
              <div className="text-xs text-gray-700">בסיס החישוב: {i.basis}</div>
              {(i.last_payment_amount !== null || i.last_payment_date) && (
                <div className="text-xs text-gray-600">
                  תשלום אחרון: {i.last_payment_amount !== null ? <span dir="ltr">{ils(Number(i.last_payment_amount))}</span> : "סכום לא צוין"}{i.last_payment_date ? ` · ${fmtDate(i.last_payment_date)}` : ""}
                </div>
              )}
              {i.notes && <div className="text-xs text-gray-600">{i.notes}</div>}
              <div className="text-xs text-gray-500">עודכן: {fmtTs(i.updated_at)}</div>
              <PaymentsList history={histories.get(i.id)} available={linksAvailable} isAdmin={isAdmin} />
              {isAdmin && <ItemEditor item={i} />}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <details className="rounded-xl border border-gray-200 p-2">
            <summary className="font-semibold text-sm cursor-pointer">+ הוספת סעיף</summary>
            <ItemForm />
          </details>
        )}
        {stopped.length > 0 && (
          <details>
            <summary className="text-sm text-gray-700 cursor-pointer">סעיפים שהופסקו ({stopped.length})</summary>
            <ul className="divide-y divide-gray-100 mt-1">
              {stopped.map((i: any) => (
                <li key={i.id} className="py-2 text-sm space-y-1">
                  <div className="flex justify-between gap-2"><span>{i.name}{i.supplier ? ` · ${i.supplier}` : ""}</span><span className="tabular-nums" dir="ltr">{ils(i.monthly_estimate)}</span></div>
                  <div className="text-xs text-gray-600">הופסק {i.stopped_at ? fmtTs(i.stopped_at) : ""}{i.stop_reason ? ` · ${i.stop_reason}` : ""}</div>
                  <PaymentsList history={histories.get(i.id)} available={linksAvailable} isAdmin={isAdmin} />
                  {isAdmin && (
                    <ActionForm action={setForecastItemActive} className="inline">
                      <input type="hidden" name="id" value={i.id} /><input type="hidden" name="active" value="true" />
                      <SubmitButton className="text-sm text-brand-700 font-semibold min-h-[44px]" pendingText="מחזיר...">החזרה לתחזית</SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card space-y-3" aria-labelledby="as-title">
        <h2 id="as-title" className="font-bold">הנחות הכנסה</h2>
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">החזר חשמל מליבנה 4 (לחודש)</span>
            <span className="font-bold tabular-nums" dir="ltr">{ils(refund)}</span>
          </div>
          <p className="text-xs text-gray-700">{settings?.refund_basis || "בסיס לא הוזן."}</p>
          <p className="text-xs text-gray-600">זהו החזר משתנה לפי צריכה, לא הכנסה קבועה מובטחת. {settings?.updated_at ? `עודכן: ${fmtTs(settings.updated_at)}.` : ""}</p>
          {isAdmin && (
            <details>
              <summary className="text-sm text-brand-700 cursor-pointer">עריכת ההנחה</summary>
              <ActionForm action={saveForecastSettings} keepOnSuccess className="space-y-2 mt-2">
                <div><label className={lbl}>החזר חודשי (₪)</label><input name="libna4_refund" inputMode="decimal" defaultValue={refund} className={inp} required /></div>
                <div><label className={lbl}>בסיס ההנחה</label><textarea name="refund_basis" defaultValue={settings?.refund_basis ?? ""} rows={3} className={inp} /></div>
                <SubmitButton>שמירת ההנחה</SubmitButton>
              </ActionForm>
            </details>
          )}
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-3">
          <h3 className="font-semibold">תרחיש: דירות שאינן משלמות</h3>
          <p className="text-xs font-semibold text-orange-800">תרחיש היפותטי לתכנון, אינו מעיד על אי־תשלום בפועל</p>
          <p className="text-xs text-gray-600">מספר דירות בכל קבוצת תעריף, בלי לבחור דירות מסוימות. ההפחתה לפי התעריף התקף לכל חודש, ולא יותר ממספר הדירות בקבוצה.</p>
          {groupList.length === 0 && <p className="text-sm text-gray-600">אין קבוצות תעריף לחודשי התחזית.</p>}
          <ul className="divide-y divide-gray-100">
            {groupList.map(([fee, size]) => {
              const cur = scenarios.find((s: any) => s.fee_amount === fee)?.non_paying ?? 0;
              return (
                <li key={fee} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm">קבוצת תעריף <b dir="ltr" className="tabular-nums">{ils(fee)}</b> <span className="text-xs text-gray-600">({size} דירות)</span></span>
                  {isAdmin ? (
                    <ActionForm action={setForecastScenario} keepOnSuccess className="flex items-center gap-2">
                      <input type="hidden" name="fee_amount" value={fee} />
                      <label className="sr-only" htmlFor={`np-${fee}`}>מספר דירות שאינן משלמות בקבוצה {fee}</label>
                      <input id={`np-${fee}`} name="non_paying" type="number" min={0} max={size} step={1} defaultValue={cur} className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm min-h-[44px]" dir="ltr" />
                      <SubmitButton className="btn-primary text-sm px-4 min-h-[44px]" pendingText="שומר...">עדכון</SubmitButton>
                    </ActionForm>
                  ) : (
                    <span className="text-sm tabular-nums">{cur} לא משלמות</span>
                  )}
                </li>
              );
            })}
          </ul>
          {orphanScenarios.length > 0 && (
            <p className="text-xs text-orange-800">
              הוגדר תרחיש לקבוצת תעריף שאינה קיימת בחודשי התחזית ({orphanScenarios.map((s: any) => ils(s.fee_amount)).join(", ")}), ולכן אינו משפיע.
            </p>
          )}
        </div>
      </section>

      <section className="card space-y-2" aria-labelledby="oo-title">
        <h2 id="oo-title" className="font-bold">הוצאות צפויות מיוחדות</h2>
        <p className="text-xs text-gray-600">הוצאה חד־פעמית לחודש מסוים, שאינה הופכת להוצאה קבועה.</p>
        {oneOffs.length === 0 && <p className="text-sm text-gray-600">אין הוצאות מיוחדות.</p>}
        <ul className="divide-y divide-gray-100">
          {oneOffs.map((o: any) => (
            <li key={o.id} className="py-2 space-y-1">
              <div className="flex justify-between gap-2 text-sm"><span>{o.title} · {monthName(o.month)} {o.year}</span><b className="tabular-nums" dir="ltr">{ils(o.amount)}</b></div>
              {o.note && <div className="text-xs text-gray-600">{o.note}</div>}
              {isAdmin && (
                <details>
                  <summary className="text-xs text-red-700 cursor-pointer">הסרה מהתחזית</summary>
                  <ActionForm action={voidForecastOneOff} className="space-y-2 mt-1">
                    <input type="hidden" name="id" value={o.id} />
                    <div><label className={lbl}>סיבה (נרשמת ביומן)</label><input name="reason" className={inp} required minLength={3} /></div>
                    <SubmitButton className="w-full rounded-lg bg-red-700 text-white text-sm py-2.5 min-h-[44px]" pendingText="מסיר...">הסרה</SubmitButton>
                  </ActionForm>
                </details>
              )}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <details className="rounded-xl border border-gray-200 p-2">
            <summary className="font-semibold text-sm cursor-pointer">+ הוספת הוצאה צפויה לחודש</summary>
            <ActionForm action={addForecastOneOff} className="space-y-2 mt-2">
              <div>
                <label className={lbl}>חודש</label>
                <select name="ym" className={inp} required defaultValue={`${months[0].year}-${String(months[0].month).padStart(2, "0")}`}>
                  {months.map((m) => <option key={`${m.year}-${m.month}`} value={`${m.year}-${String(m.month).padStart(2, "0")}`}>{label(m)}</option>)}
                </select>
              </div>
              <div><label className={lbl}>תיאור</label><input name="title" className={inp} required /></div>
              <div><label className={lbl}>סכום (₪)</label><input name="amount" inputMode="decimal" className={inp} required /></div>
              <div><label className={lbl}>הערה</label><input name="note" className={inp} /></div>
              <SubmitButton>הוספה</SubmitButton>
            </ActionForm>
          </details>
        )}
      </section>
    </div>
  );
}

function ItemForm({ item }: { item?: any }) {
  return (
    <ActionForm action={saveForecastItem} keepOnSuccess={!!item} className="space-y-2 mt-2">
      {item && <><input type="hidden" name="id" value={item.id} /><input type="hidden" name="row_version" value={item.row_version} /></>}
      <div><label className={lbl}>שם הסעיף</label><input name="name" defaultValue={item?.name ?? ""} className={inp} required /></div>
      <div><label className={lbl}>ספק</label><input name="supplier" defaultValue={item?.supplier ?? ""} className={inp} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={lbl}>אומדן חודשי (₪)</label><input name="monthly_estimate" inputMode="decimal" defaultValue={item?.monthly_estimate ?? ""} className={inp} required /></div>
        <div>
          <label className={lbl}>סוג</label>
          <select name="kind" defaultValue={item?.kind ?? "recurring"} className={inp}>
            <option value="recurring">הוצאה קבועה</option>
            <option value="allocation">הקצאה חודשית משוערת</option>
          </select>
        </div>
      </div>
      <div><label className={lbl}>בסיס החישוב (חובה)</label><textarea name="basis" defaultValue={item?.basis ?? ""} rows={2} className={inp} required /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={lbl}>תשלום אחרון (₪, אם ידוע)</label><input name="last_payment_amount" inputMode="decimal" defaultValue={item?.last_payment_amount ?? ""} className={inp} /></div>
        <div><label className={lbl}>תאריך תשלום אחרון (אם ידוע)</label><input name="last_payment_date" type="date" defaultValue={item?.last_payment_date ?? ""} className={inp} /></div>
      </div>
      <div><label className={lbl}>הערות</label><input name="notes" defaultValue={item?.notes ?? ""} className={inp} /></div>
      <SubmitButton>{item ? "שמירת שינויים" : "הוספת סעיף"}</SubmitButton>
    </ActionForm>
  );
}

function PaymentsList({ history, available, isAdmin }: { history?: ItemHistory; available: boolean; isAdmin: boolean }) {
  if (!available) return <div className="text-xs text-gray-500">היסטוריית התשלומים אינה זמינה כרגע.</div>;
  const n = history?.count ?? 0;
  return (
    <details data-details="payments" className="rounded-lg border border-gray-200 px-2">
      <summary className="cursor-pointer text-sm text-brand-700 font-semibold min-h-[44px] inline-flex items-center w-full">כל התשלומים{n ? ` (${n})` : ""}</summary>
      <div className="pb-2 space-y-2">
        {!history || !n ? (
          <p data-state="no-linked" className="text-xs text-gray-700">
            עדיין לא שויכו תשלומים להוצאה זו. השיוך ידני, ולכן זה לא אומר שלא שולמו תשלומים.
            {isAdmin && <> <Link href="/forecast/link" className="text-brand-700 underline">לשיוך תשלומים</Link></>}
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-700" data-v="summary">{n === 1 ? "תשלום אחד ששויך" : `${n} תשלומים ששויכו`} · סך ששולם: <b dir="ltr">{ils(history.totalAgorot / 100)}</b> <span className="text-gray-500">(רק תשלומים ששויכו ידנית)</span></p>
            <ul className="divide-y divide-gray-100">
              {history.rows.map((r) => (
                <li key={r.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="break-words">{r.description ?? "ללא תיאור"}</div>
                    <div className="text-xs text-gray-500">{fmtDate(r.date)} · <Link href={`/finances#tx-${r.id}`} className="text-brand-700 underline">לתנועה המקורית</Link></div>
                  </div>
                  <div className="font-semibold tabular-nums whitespace-nowrap" dir="ltr">{ils(Number(r.amount))}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}

function ItemEditor({ item }: { item: any }) {
  return (
    <div className="space-y-1">
      <details>
        <summary className="text-sm text-brand-700 cursor-pointer">עריכה</summary>
        <ItemForm item={item} />
      </details>
      <details>
        <summary className="text-sm text-red-700 cursor-pointer">הפסקת הסעיף</summary>
        <ActionForm action={setForecastItemActive} className="space-y-2 mt-1">
          <input type="hidden" name="id" value={item.id} /><input type="hidden" name="active" value="false" />
          <div><label className={lbl}>סיבה (נרשמת ביומן)</label><input name="reason" className={inp} required minLength={3} /></div>
          <SubmitButton className="w-full rounded-lg bg-red-700 text-white text-sm py-2.5 min-h-[44px]" pendingText="מפסיק..." confirmText="להפסיק את הסעיף ולהוציא אותו מהתחזית?">הפסקה</SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}
