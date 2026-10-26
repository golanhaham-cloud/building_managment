"use client";

import { useEffect } from "react";

// הודעת הצלחה שמגיעה מהשרת אחרי שמירה. מנקה את הפרמטר מהכתובת כדי שרענון לא יציג אותה שוב.
export default function DoneBanner({ text, keep, path = "/payments/allocate" }: { text: string; keep: string; path?: string }) {
  useEffect(() => {
    try {
      window.history.replaceState(null, "", `${path}${keep ? `?${keep}` : ""}`);
    } catch {
      /* ignore */
    }
  }, [keep, path]);
  return (
    <p role="status" className="rounded-lg bg-green-50 text-green-800 text-sm p-3">
      ✔ {text}
    </p>
  );
}
