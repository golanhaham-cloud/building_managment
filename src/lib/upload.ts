"use client";

import { createClient } from "@/lib/supabase/client";
import { extOf } from "@/lib/files";

function hebrewStorageError(msg: string) {
  if (/maximum allowed size|too large|payload/i.test(msg)) return "הקובץ גדול מהמגבלה (25MB).";
  if (/mime type|not supported/i.test(msg)) return "סוג הקובץ אינו מותר.";
  if (/row-level security|unauthorized|not authorized|403/i.test(msg)) return "אין הרשאה להעלות קובץ זה.";
  return "העלאת הקובץ נכשלה. נסה שוב.";
}

// Direct browser -> Supabase Storage upload under the user's own session.
// Authorization is enforced by storage policies, not by this code.
export async function uploadToBucket(bucket: string, folder: string, file: File): Promise<string> {
  const supabase = createClient();
  const path = `${folder}/${crypto.randomUUID()}.${extOf(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(hebrewStorageError(error.message));
  return path;
}
