// Safe parsing of a free-text phone field that may hold several numbers.
// Rules: split only on comma / slash / semicolon / newline / the word "או".
// Spaces and hyphens inside a number are formatting, never separators.
// If anything is unclear, return the original text with NO dial link (never guess, never join).

export type PhoneEntry = { display: string; dial: string; label?: string };
export type PhoneParse =
  | { kind: "empty" }
  | { kind: "numbers"; items: PhoneEntry[] }
  | { kind: "raw"; text: string };

const NUMBER_RE = /[+(]?\s*\d[\d\s\-().]*\d/g;

function validDial(dial: string): boolean {
  if (dial.startsWith("+")) return /^\+\d{8,15}$/.test(dial);
  if (dial.startsWith("00")) return /^\d{10,17}$/.test(dial);
  return /^0\d{8,9}$/.test(dial); // Israeli local: 9 digits (landline) or 10 (mobile)
}

export function parsePhones(raw: string | null | undefined): PhoneParse {
  const text = (raw ?? "").trim();
  if (!text) return { kind: "empty" };

  const normalized = text.replace(/(^|\s)או(?=\s|$)/g, ",");
  const segments = normalized
    .split(/[,;،/\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return { kind: "raw", text };

  const items: PhoneEntry[] = [];
  for (const seg of segments) {
    const matches = seg.match(NUMBER_RE) ?? [];
    if (matches.length !== 1) return { kind: "raw", text }; // none, or several numbers not clearly separated
    const m = matches[0];
    const plus = /^\s*\(?\s*\+/.test(m) || /^\+/.test(m.trim());
    const digits = m.replace(/\D/g, "");
    const dial = (plus ? "+" : "") + digits;
    if (!validDial(dial)) return { kind: "raw", text };
    const label = seg.replace(m, " ").replace(/[\s:\-–()]+/g, " ").trim();
    items.push({ display: m.replace(/^[(\s]+|[)\s]+$/g, "").replace(/\s+/g, " ").trim(), dial, label: label || undefined });
  }
  return { kind: "numbers", items };
}
