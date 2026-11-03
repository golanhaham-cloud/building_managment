// דוח PDF חודשי להצגה לדיירים: הכנסות בסיכום (ללא פרטי משלמים), הוצאות בפירוט.
// pdfkit (fontkit) מסדר bidi בעצמו - מעבירים מחרוזות בסדר לוגי, עם גופן Alef מוטמע.
// הבדיקות: tests/pdf-report.test.ts. אין כאן גישה למסד - הנתונים מוכנים ב-route.
import PDFDocument from "pdfkit";
import { monthName } from "../components/ui";
import { ALEF_REG_B64, ALEF_BOLD_B64 } from "./fonts-data";

export const ag = (n: number | string) => Math.round(Number(n) * 100);

// עיצוב סכום מאגורות: "1,234 ₪" / "97.50 ₪". הספרות נשארות LTR כחלק מסדר ה-bidi.
export function ilsAg(a: number): string {
  const v = a / 100;
  const s = v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${s} ₪`;
}

export type ReportExpense = { date: string; description: string; category: string; supplier: string; amountAg: number };
export type ReportIncomeGroup = { name: string; totalAg: number; count: number };
export type MonthlyReportData = {
  monthLabel: string;
  generatedLabel: string;
  incomeTotalAg: number;
  vaadAg: number;
  vaadCount: number;
  otherIncomeAg: number;
  incomeGroups: ReportIncomeGroup[];
  expenses: ReportExpense[];
  expenseTotalAg: number;
  balanceEndAg: number | null;
};

// הפונטים מוטמעים כ-base64 (fonts-data.ts) כי קבצי fs מה-repo אינם מובטחים ב-serverless.
const REG = Buffer.from(ALEF_REG_B64, "base64");
const BOLD = Buffer.from(ALEF_BOLD_B64, "base64");
const L = 50, R = 545; // גבולות התוכן בעמוד A4

const INK = "#1f2937", GRAY = "#6b7280", LINE = "#d1d5db", ACCENT = "#0f766e";

export function buildMonthlyReportPdf(d: MonthlyReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.registerFont("reg", REG);
    doc.registerFont("bold", BOLD);

    const right = (t: string, x: number, y: number, w: number, o: Record<string, unknown> = {}) =>
      doc.text(t, x, y, { width: w, align: "right", lineBreak: false, ellipsis: true, ...o });
    const center = (t: string, y: number, o: Record<string, unknown> = {}) =>
      doc.text(t, L, y, { width: R - L, align: "center", lineBreak: false, ...o });
    const hline = (y: number) => doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();

    // כותרת
    doc.fillColor(INK);
    doc.font("bold").fontSize(20); center("ליבנה 6 - ועד הבית", 55);
    doc.font("bold").fontSize(15); center(`דוח חודשי - ${d.monthLabel}`, 84);
    doc.font("reg").fontSize(9.5).fillColor(GRAY);
    center(`הופק בתאריך ${d.generatedLabel} · הדוח מבוסס על רישומי האתר בלבד ואינו יתרת הבנק בפועל`, 108);
    doc.fillColor(INK);

    let y = 140;
    // סיכום החודש
    doc.font("bold").fontSize(13); right("סיכום החודש", L, y, R - L); y += 22;
    const sumRow = (label: string, value: string, bold = false) => {
      doc.font(bold ? "bold" : "reg").fontSize(11);
      right(label, 300, y, 245);
      right(value, L, y, 240);
      y += 18;
    };
    sumRow("סה\"כ הכנסות", ilsAg(d.incomeTotalAg), true);
    sumRow(`מתוכן דמי ועד (${d.vaadCount} תשלומים)`, ilsAg(d.vaadAg));
    sumRow("הכנסות אחרות", ilsAg(d.otherIncomeAg));
    sumRow("סה\"כ הוצאות", ilsAg(d.expenseTotalAg), true);
    hline(y - 6);
    sumRow("מאזן החודש (הכנסות פחות הוצאות)", ilsAg(d.incomeTotalAg - d.expenseTotalAg), true);
    if (d.balanceEndAg != null) sumRow(`יתרה מחושבת בסוף ${d.monthLabel} (לפי הרישומים)`, ilsAg(d.balanceEndAg));
    y += 10;

    const pageBreak = (need: number) => {
      if (y + need > 800) { doc.addPage(); y = 60; }
    };

    // פירוט הוצאות
    pageBreak(60);
    doc.font("bold").fontSize(13); right(`פירוט הוצאות (${d.expenses.length})`, L, y, R - L); y += 20;
    // עמודות מימין לשמאל: תאריך | תיאור | קטגוריה | ספק | סכום
    const cols = [
      { h: "תאריך", x: 480, w: 65 },
      { h: "תיאור", x: 270, w: 205 },
      { h: "קטגוריה", x: 185, w: 80 },
      { h: "ספק", x: 115, w: 65 },
      { h: "סכום", x: L, w: 60 },
    ];
    const tableHead = () => {
      doc.font("bold").fontSize(10);
      for (const c of cols) right(c.h, c.x, y, c.w);
      y += 14; hline(y); y += 6;
    };
    tableHead();
    doc.font("reg").fontSize(10);
    if (!d.expenses.length) { doc.fillColor(GRAY); right("אין הוצאות רשומות בחודש זה", L, y, R - L); doc.fillColor(INK); y += 18; }
    for (const e of d.expenses) {
      pageBreak(30);
      if (y < 70) tableHead(); // כותרת טבלה חוזרת בעמוד חדש
      right(e.date, cols[0].x, y, cols[0].w);
      right(e.description, cols[1].x, y, cols[1].w);
      right(e.category, cols[2].x, y, cols[2].w);
      right(e.supplier, cols[3].x, y, cols[3].w);
      right(ilsAg(e.amountAg), cols[4].x, y, cols[4].w);
      y += 16;
      hline(y - 4); y += 2;
    }
    doc.font("bold").fontSize(10.5); right("סה\"כ הוצאות", 270, y + 2, 205); right(ilsAg(d.expenseTotalAg), L, y + 2, 60); y += 28;

    // פירוט הכנסות - סיכום בלבד, ללא פרטי משלמים
    pageBreak(80);
    doc.font("bold").fontSize(13); right(`פירוט הכנסות - סיכום (${d.incomeGroups.reduce((s, g) => s + g.count, 0)} תנועות)`, L, y, R - L); y += 20;
    for (const g of d.incomeGroups) {
      pageBreak(20);
      doc.font("reg").fontSize(11);
      right(`${g.name} (${g.count})`, 250, y, 295);
      right(ilsAg(g.totalAg), L, y, 190);
      y += 17;
    }
    hline(y - 5);
    doc.font("bold").fontSize(11); right("סה\"כ הכנסות", 250, y + 2, 295); right(ilsAg(d.incomeTotalAg), L, y + 2, 190); y += 26;
    doc.font("reg").fontSize(9).fillColor(GRAY);
    right("פרטי המשלמים אינם מוצגים בדוח זה. לשאלות: ועד הבית.", L, y, R - L);

    doc.end();
  });
}
