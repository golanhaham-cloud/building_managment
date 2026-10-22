// Shared (client + server) file rules. The same limits are enforced by Supabase Storage
// itself (bucket file_size_limit + allowed_mime_types) and by storage RLS policies.
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB
export const MAX_FILES_PER_REQUEST = 10;

const IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
const VIDEOS = ["video/mp4", "video/quicktime", "video/webm"];
const DOCS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

export const REQUEST_FILE_TYPES = [...IMAGES, ...VIDEOS, ...DOCS];
export const COMMITTEE_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", ...DOCS.slice(1)];

export const REQUEST_FILE_HINT = "תמונות (JPG, PNG, WEBP, GIF, HEIC), סרטונים (MP4, MOV, WEBM), מסמכים (PDF, Word, Excel, TXT) · עד 25MB לקובץ · עד 10 קבצים לפנייה";
export const COMMITTEE_DOC_HINT = "PDF, תמונות (JPG, PNG, WEBP), Word, Excel, TXT · עד 25MB לקובץ";

export const ACCEPT = (types: string[]) => types.join(",");

export function validateFile(file: { name: string; size: number; type: string }, allowed: string[]): string | null {
  if (!file.size) return `הקובץ "${file.name}" ריק`;
  if (file.size > MAX_FILE_BYTES) return `הקובץ "${file.name}" גדול מדי (${fmtSize(file.size)}). המגבלה היא 25MB`;
  if (!allowed.includes(file.type)) return `סוג הקובץ "${file.name}" אינו מותר`;
  return null;
}

export function fmtSize(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export function extOf(name: string) {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return m ? m[1].toLowerCase() : "bin";
}

export const INLINE_TYPES = new Set([...IMAGES.filter((t) => t !== "image/heic"), ...VIDEOS, "application/pdf", "text/plain"]);

export const URGENCY_LABELS: Record<string, string> = {
  low: "נמוכה",
  normal: "רגילה",
  high: "גבוהה",
  urgent: "דחופה",
};
export const URGENCY_OPTIONS = ["low", "normal", "high", "urgent"] as const;
export const URGENCY_BADGE: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};
export const fileIcon = (mime: string) =>
  mime.startsWith("image/") ? "🖼️" : mime.startsWith("video/") ? "🎬" : mime === "application/pdf" ? "📕" : "📄";
