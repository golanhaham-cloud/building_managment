import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { buildMonthlyReportPdf, ag, type MonthlyReportData, type ReportExpense, type ReportIncomeGroup } from "@/lib/pdf-report";
import { monthName } from "@/components/ui";

export const dynamic = "force-dynamic";

// דוח PDF חודשי לדיירים: הכנסות בסיכום בלבד (ללא פרטי משלמים), הוצאות בפירוט.
// גלוי לכל משתמש מחובר בבניין - נתוני הדוח מכילים פחות ממה שגלוי בעמוד הכספים עצמו.
export async function GET(req: NextRequest) {
  try {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  if (!appUser) return new NextResponse("יש להתחבר", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const month = Number(sp.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || year > 2100 || month < 1 || month > 12) {
    return new NextResponse("חודש לא תקין", { status: 400 });
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${year}-${pad(month)}-01`;
  const to = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;

  const [{ data: rows }, { data: balanceRow }] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, date, amount, description, categories(name), suppliers(name)")
      .eq("building_id", appUser.building_id)
      .is("voided_at", null)
      .order("date"),
    supabase.from("building_balance").select("current_balance").eq("building_id", appUser.building_id).maybeSingle(),
  ]);

  const all = (rows ?? []) as any[];
  const inMonth = all.filter((t) => String(t.date) >= from && String(t.date) < to);
  // יתרה מחושבת בסוף החודש: היתרה הנוכחית פחות נטו התנועות שאחרי החודש.
  let netAfterAg = 0;
  for (const t of all) {
    if (String(t.date) >= to) netAfterAg += (t.type === "income" ? 1 : -1) * ag(t.amount);
  }
  const cur = (balanceRow as any)?.current_balance;
  const balanceEndAg = cur == null ? null : ag(cur) - netAfterAg;

  const groups = new Map<string, ReportIncomeGroup>();
  const expenses: ReportExpense[] = [];
  let vaadAg = 0, vaadCount = 0, incomeTotalAg = 0, expenseTotalAg = 0;
  for (const t of inMonth) {
    if (t.type === "income") {
      const a = ag(t.amount);
      incomeTotalAg += a;
      const name = t.categories?.name ?? "ללא קטגוריה";
      const g = groups.get(name) ?? { name, totalAg: 0, count: 0 };
      g.totalAg += a; g.count += 1; groups.set(name, g);
      if (name === "ועד בית") { vaadAg += a; vaadCount += 1; }
    } else if (t.type === "expense") {
      const a = ag(t.amount);
      expenseTotalAg += a;
      expenses.push({
        date: String(t.date).slice(8, 10) + "." + String(t.date).slice(5, 7),
        description: String(t.description ?? ""),
        category: t.categories?.name ?? "ללא קטגוריה",
        supplier: t.suppliers?.name ?? "",
        amountAg: a,
      });
    }
  }
  const incomeGroups = Array.from(groups.values()).sort((x, y) => y.totalAg - x.totalAg);

  const now = new Date();
  const data: MonthlyReportData = {
    monthLabel: `${monthName(month)} ${year}`,
    generatedLabel: `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`,
    incomeTotalAg,
    vaadAg,
    vaadCount,
    otherIncomeAg: incomeTotalAg - vaadAg,
    incomeGroups,
    expenses,
    expenseTotalAg,
    balanceEndAg,
  };
  const pdf = await buildMonthlyReportPdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="livne6-report-${year}-${pad(month)}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
  } catch (e) {
    // זמני: חשיפת שגיאת שרת לאבחון הדור (יוחזר להודעה כללית לפני פרסום סופי)
    return new NextResponse("report error: " + String((e as Error)?.stack ?? e), { status: 500 });
  }
}
