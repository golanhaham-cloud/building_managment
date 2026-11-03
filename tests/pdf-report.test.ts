import { buildMonthlyReportPdf, ilsAg } from "../src/lib/pdf-report";
let fails = 0;
function ok(n: string, c: boolean) { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; }
ok("ilsAg formats whole shekels", ilsAg(33000) === "330 ₪");
ok("ilsAg formats agorot", ilsAg(9750) === "97.50 ₪");
ok("ilsAg thousands separator", ilsAg(966748) === "9,667.48 ₪");
async function main() {
const pdf = await buildMonthlyReportPdf({
  monthLabel: "נובמבר 2026",
  generatedLabel: "3.11.2026",
  incomeTotalAg: 93000,
  vaadAg: 93000,
  vaadCount: 3,
  otherIncomeAg: 0,
  incomeGroups: [{ name: "ועד בית", totalAg: 93000, count: 3 }],
  expenses: [
    { date: "02.11", description: "ניקיון חדר מדרגות - חודשי", category: "ניקיון", supplier: "נקי בע\"מ", amountAg: 45000 },
    { date: "03.11", description: "חשמל", category: "חשמל", supplier: "חברת חשמל", amountAg: 12345 },
  ],
  expenseTotalAg: 57345,
  balanceEndAg: 966748,
});
ok("returns a PDF buffer", pdf.length > 2000 && pdf.subarray(0, 5).toString() === "%PDF-");
ok("pdf ends with EOF marker", pdf.subarray(pdf.length - 32).toString().includes("%%EOF"));
if (fails) process.exit(1);
console.log("all passed");
}
main();
