// דוח PDF חודשי להצגה לדיירים: הכנסות בסיכום (ללא פרטי משלמים), הוצאות בפירוט.
// pdfkit 0.15 (fontkit) מסדר bidi בתוך מחרוזת, אך רווחים נאבדים בגבולות בין רצפים
// (עברית/ספרות/₪) - לכן שורות עם עברית מצוירות מילה-מילה בסדר חזותי שאנחנו מחשבים,
// כולל היפוך סוגריים. הבדיקות: tests/pdf-report.test.ts. אין כאן גישה למסד.
import PDFDocument from "pdfkit";
import { monthName } from "../components/ui";
import { ALEF_REG_B64, ALEF_BOLD_B64 } from "./fonts-data";

export const ag = (n: number | string) => Math.round(Number(n) * 100);

// עיצוב סכום מאגורות: "1,234 ₪" / "97.50 ₪"
export function ilsAg(a: number): string {
  const v = a / 100;
  const s = v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${s} ₪`;
}

const HEB = /[\u0590-\u05FF]/;
const MIRROR: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{" };
const mirrorParens = (w: string) => w.replace(/[()[\]{}]/g, (c) => MIRROR[c] ?? c);

// סדר חזותי ברמת מילה לשורת RTL: היפוך סדר המילים + היפוך סוגריים, תוכן כל מילה נשאר.
export function rtlWords(line: string): string[] {
  return line.split(/\s+/).filter(Boolean).reverse().map(mirrorParens);
}

export type ReportExpense = { date: string; description: string; category: string; supplier: string; amountAg: number };
export type ReportIncomeGroup = { name: string; totalAg: number; count: number };
export type MonthlyReportData = {
  monthLabel: string;
  generatedLabel: string;
  incomeTotalAg: number;
  // תקבולי דיירים: סיווג לפי שיוכים מאושרים/קטגוריה - לא לפי תיאור חופשי
  residentTotalAg: number;
  residentCount: number;
  duesAg: number;       // שיוכי דמי ועד + יתרות לא משויכות של תקבולים בקטגוריית ועד בית
  levyAg: number;       // שיוכי מטרה מיוחדת (שיפור הבניין)
  unallocatedAg: number; // יתרות לא משויכות של תקבולי דיירים ללא קטגוריה
  otherGroups: ReportIncomeGroup[]; // הכנסות שאינן תשלומי דיירים, לפי קטגוריה
  expenses: ReportExpense[];
  expenseTotalAg: number;
  balanceEndAg: number | null;
};

// הפונטים מוטמעים כ-base64 (fonts-data.ts) כי קבצי fs מה-repo אינם מובטחים ב-serverless.
const REG = Buffer.from(ALEF_REG_B64, "base64");
const BOLD = Buffer.from(ALEF_BOLD_B64, "base64");
const L = 50, R = 545; // גבולות התוכן בעמוד A4
const INK = "#1f2937", GRAY = "#6b7280", LINE = "#d1d5db";

export function buildMonthlyReportPdf(d: MonthlyReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.registerFont("reg", REG);
    doc.registerFont("bold", BOLD);

    // ציור שורה: שורות עם עברית - מילה-מילה בסדר חזותי; שורות LTR בלבד - ציור רגיל.
    const drawLine = (t: string, x: number, y: number, w: number, align: "right" | "center" = "right", maxW?: number) => {
      if (!HEB.test(t)) { doc.text(t, x, y, { width: w, align, lineBreak: false, ellipsis: true }); return; }
      const words = rtlWords(t);
      const spaceW = doc.widthOfString(" ");
      const limit = maxW ?? w;
      // קיצוץ לרוחב התא: מסירים מילים מקצה השורה החזותי (שמאל) ומוסיפים סימן השמטה.
      while (words.length > 1) {
        const tot = words.reduce((a, wd) => a + doc.widthOfString(wd), 0) + spaceW * (words.length - 1);
        if (tot <= limit) break;
        words.pop();
        words[words.length - 1] = words[words.length - 1] + "…";
      }
      const widths = words.map((word) => doc.widthOfString(word));
      const total = widths.reduce((a, b) => a + b, 0) + spaceW * (words.length - 1);
      let cx = align === "center" ? x + Math.max(0, (w - total) / 2) : x + w - total;
      for (let i = 0; i < words.length; i++) {
        doc.text(words[i], cx, y, { lineBreak: false });
        cx += widths[i] + spaceW;
      }
    };
    const right = (t: string, x: number, y: number, w: number) => drawLine(t, x, y, w, "right");
    const center = (t: string, y: number) => drawLine(t, L, y, R - L, "center");
    const hline = (y: number) => doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();

    // כותרת
    doc.fillColor(INK);
    doc.font("bold").fontSize(20); center("ליבנה 6 - ועד הבית", 55);
    doc.font("bold").fontSize(15); center(`דוח חודשי - ${d.monthLabel}`, 84);
    doc.font("reg").fontSize(9.5).fillColor(GRAY);
    center(`הופק בתאריך ${d.generatedLabel} · הדוח מבוסס על רישומי האתר בלבד ואינו יתרת הבנק בפועל`, 108);
    doc.fillColor(INK);

    let y = 140;
    doc.font("bold").fontSize(13); right("סיכום החודש", L, y, R - L); y += 22;
    const sumRow = (label: string, value: string, bold = false) => {
      doc.font(bold ? "bold" : "reg").fontSize(11);
      right(label, 300, y, 245);
      right(value, L, y, 240);
      y += 18;
    };
    sumRow("סה\"כ הכנסות", ilsAg(d.incomeTotalAg), true);
    sumRow(`מתוכן תשלומי דיירים (${d.residentCount} תקבולים)`, ilsAg(d.residentTotalAg));
    sumRow("הכנסות אחרות", ilsAg(d.otherGroups.reduce((s, g) => s + g.totalAg, 0)));
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
    const cols = [
      { h: "תאריך", x: 480, w: 65 },
      { h: "תיאור", x: 290, w: 185 },
      { h: "קטגוריה", x: 215, w: 70 },
      { h: "ספק", x: 115, w: 95 },
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
      if (y < 70) tableHead();
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
    doc.font("bold").fontSize(13); right(`פירוט הכנסות - סיכום (${d.residentCount + d.otherGroups.reduce((s, g) => s + g.count, 0)} תקבולים)`, L, y, R - L); y += 20;
    const incRow = (label: string, value: string, bold = false) => {
      pageBreak(20);
      doc.font(bold ? "bold" : "reg").fontSize(11);
      right(label, 250, y, 295);
      right(value, L, y, 190);
      y += 17;
    };
    if (d.duesAg > 0) incRow("דמי ועד (כולל יתרות שטרם שויכו)", ilsAg(d.duesAg));
    if (d.levyAg > 0) incRow("מטרה מיוחדת - שיפור הבניין", ilsAg(d.levyAg));
    if (d.unallocatedAg > 0) incRow("תקבולי דיירים שטרם שויכו", ilsAg(d.unallocatedAg));
    for (const g of d.otherGroups) incRow(`${g.name} (${g.count})`, ilsAg(g.totalAg));
    hline(y - 5);
    incRow("סה\"כ הכנסות", ilsAg(d.incomeTotalAg), true);
    y += 9;
    doc.font("reg").fontSize(9).fillColor(GRAY);
    right("פרטי המשלמים אינם מוצגים בדוח זה. לשאלות: ועד הבית.", L, y, R - L);

    doc.end();
  });
}
