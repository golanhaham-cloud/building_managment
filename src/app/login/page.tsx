"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError("שליחת הקישור נכשלה, נסה שוב.");
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-4xl mb-2">🏢</div>
      <h1 className="text-2xl font-extrabold mb-1">ליבנה 6</h1>
      <p className="text-gray-500 mb-8">מערכת ניהול ושקיפות הבניין</p>

      {sent ? (
        <div className="card w-full max-w-sm text-center">
          <p className="font-semibold mb-1">שלחנו לך קישור התחברות</p>
          <p className="text-sm text-gray-500">בדוק/י את תיבת המייל שלך ולחצ/י על הקישור כדי להיכנס.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            כתובת מייל
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-right"
            dir="ltr"
          />
          {error && <p className="text-sm text-status-unpaid">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "שולח..." : "שלח/י לי קישור התחברות"}
          </button>
        </form>
      )}
    </div>
  );
}
