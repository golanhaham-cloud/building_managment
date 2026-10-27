// בדיקת שדות טופס החלטת ועד (בצד הלקוח), עם הודעות בעברית. הבדיקה המחייבת נשארת בשרת ובמסד ולא משתנה.
export type GapFormErrors = { amount?: string; reason?: string };

export function validateGapForm(v: { amount: string; reason: string }): GapFormErrors {
  const e: GapFormErrors = {};
  const a = v.amount.trim();
  if (!a) e.amount = "יש להזין סכום";
  else if (!/^\d{1,8}(\.\d{1,2})?$/.test(a) || !(Number(a) > 0)) e.amount = "הסכום לא תקין: מספר חיובי עד שתי ספרות אחרי הנקודה";
  const r = v.reason.trim();
  if (!r) e.reason = "יש להזין סיבה או אסמכתה";
  else if (r.length < 3) e.reason = "הסיבה קצרה מדי (לפחות 3 תווים)";
  else if (r.length > 500) e.reason = "הסיבה ארוכה מדי (עד 500 תווים)";
  return e;
}

export const GAP_SUMMARY_ERROR = "לא ניתן לשמור: יש להשלים את השדות המסומנים באדום.";
