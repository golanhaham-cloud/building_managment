"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ERRORS: Record<string, string> = {
  email_not_found: "המייל שלך לא רשום ברשימת הדיירים. פנה/י לוועד כדי שיעדכנו אותו.",
  bad_code: "קוד הבניין שגוי.",
  no_session: "יש להתחבר מחדש.",
};

export default function ClaimPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data } = await supabase.rpc("claim_resident_account", { p_code: code });
    if (data === "ok") {
      window.location.href = "/dashboard";
      return;
    }
    setLoading(false);
    setError(ERRORS[data as string] ?? "החיבור נכשל.");
  }

  async function logout() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-4xl mb-2">🔑</div>
      <h1 className="text-xl font-extrabold mb-1">חיבור לבניין</h1>
      <p className="text-gray-500 mb-6 text-center text-sm">הזן/י את קוד הבניין שקיבלת מהוועד כדי לסיים.</p>
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
        <input
          type="text"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-right"
          dir="ltr"
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "רגע..." : "המשך"}
        </button>
        <button type="button" onClick={logout} className="w-full text-sm text-gray-500">
          יציאה
        </button>
      </form>
    </div>
  );
}
