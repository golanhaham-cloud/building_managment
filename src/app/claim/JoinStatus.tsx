"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function JoinStatus({ status, email, requestedAt }: { status: "pending" | "rejected"; email: string; requestedAt: string }) {
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    if (leaving) return;
    setLeaving(true);
    setError(null);
    try {
      await createClient().auth.signOut();
      window.location.href = "/login";
    } catch {
      setLeaving(false);
      setError("היציאה לא הושלמה, נסה/י שוב.");
    }
  }

  const pending = status === "pending";
  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex flex-col items-center justify-center px-6">
      <div className="text-4xl mb-2" aria-hidden="true">{pending ? "⏳" : "🚫"}</div>
      <h1 className="text-xl font-extrabold mb-1 text-center">
        {pending ? "הבקשה נשלחה לוועד וממתינה לאישור" : "הבקשה לא אושרה"}
      </h1>
      <div className="card w-full max-w-sm space-y-3 mt-4" role="status">
        {pending ? (
          <>
            <p className="text-sm text-gray-700">
              ברגע שהוועד יאשר את הבקשה ותשויך לדירה, תוכל/י להיכנס לאתר כרגיל. עד אז אין גישה לנתוני הבניין.
            </p>
            <p className="text-xs text-gray-600">
              מייל הבקשה: <span dir="ltr" className="break-all">{email}</span>
              <br />
              נשלחה: {new Date(requestedAt).toLocaleString("he-IL")}
            </p>
            <button type="button" onClick={() => window.location.reload()} className="btn-primary w-full min-h-[44px]">
              בדיקת מצב הבקשה
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-700">
            הוועד לא אישר את הבקשה להצטרפות. לבירור אפשר לפנות לוועד הבית. אם המייל שלך יתווסף על ידי הוועד לרשימת הדיירים, תוכל/י להתחבר מחדש עם קוד הבניין.
          </p>
        )}
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <button
          type="button"
          onClick={logout}
          aria-disabled={leaving || undefined}
          className="w-full min-h-[44px] rounded-xl border border-gray-300 text-sm aria-disabled:opacity-60"
        >
          {leaving ? "יוצא..." : "יציאה מהחשבון"}
        </button>
      </div>
    </div>
  );
}
