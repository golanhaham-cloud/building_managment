import { buildMonthlyReportPdf, rtlWords, ilsAg } from "../src/lib/pdf-report";
let fails = 0;
function ok(n: string, c: boolean) { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; }
ok("rtlWords reverses word order", rtlWords("סה\"כ הכנסות וגם").join("|") === "וגם|הכנסות|סה\"כ");
ok("rtlWords mirrors parens", rtlWords("מתוכן דמי ועד (16 תשלומים)").join("|") === "תשלומים(|)16|ועד|דמי|מתוכן");
ok("rtlWords keeps numbers intact", rtlWords("בסוף נובמבר 2026").join("|") === "2026|נובמבר|בסוף");
ok("ilsAg formats whole shekels", ilsAg(33000) === "330 ₪");
ok("ilsAg formats agorot", ilsAg(9750) === "97.50 ₪");
ok("ilsAg thousands separator", ilsAg(966748) === "9,667.48 ₪");
async function main() {
  const data = {
    monthLabel: "נובמבר 2026",
    generatedLabel: "3.11.2026",
    incomeTotalAg: 236100,
    residentTotalAg: 236100,
    residentCount: 7,
    duesAg: 190500,
    levyAg: 45100,
    unallocatedAg: 500,
    otherGroups: [] as { name: string; totalAg: number; count: number }[],
    expenses: [
      { date: "02.11", description: "בע\"מ-יקונה", category: "מעלית", supplier: "KONE (ישראל)", amountAg: 202459 },
      { date: "02.11", description: "בנקעמלות", category: "ביתועד", supplier: "", amountAg: 4950 },
    ],
    expenseTotalAg: 207574,
    balanceEndAg: 966748,
  };
  ok("income invariant holds", data.duesAg + data.levyAg + data.unallocatedAg + data.otherGroups.reduce((s, g) => s + g.totalAg, 0) === data.incomeTotalAg);
  const pdf = await buildMonthlyReportPdf(data);
  ok("returns a PDF buffer", pdf.length > 2000 && pdf.subarray(0, 5).toString() === "%PDF-");
  ok("pdf ends with EOF marker", pdf.subarray(pdf.length - 32).toString().includes("%%EOF"));
  if (fails) process.exit(1);
  console.log("all passed");
}
main();
