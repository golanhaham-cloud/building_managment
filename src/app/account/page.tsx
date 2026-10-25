"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { APP_VERSION } from "@/lib/version";

export default function AccountPage() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) {
      setOk(false);
      setMsg("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      setMsg(error ? "שגיאה: " + error.message : "הסיסמה עודכנה.");
      if (!error) setPassword("");
      setOk(!error);
    } catch {
      setOk(false);
      setMsg("אירעה שגיאת חיבור, הסיסמה לא עודכנה. נסה/י שוב.");
    }
    setLoading(false);
  }

  async function logout() {
    if (leaving) return;
    setLeaving(true);
    try {
      await createClient().auth.signOut();
      window.location.href = "/login";
    } catch {
      setLeaving(false);
      setOk(false);
      setMsg("היציאה לא הושלמה, נסה/י שוב.");
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-extrabold">החשבון שלי</h1>
      <form onSubmit={save} className="card space-y-3">
        <div className="font-semibold text-sm">הגדרת / החלפת סיסמה</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה חדשה"
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-right"
          dir="ltr"
          autoComplete="new-password"
        />
        {msg && <p className={`text-sm ${ok ? "text-green-700" : "text-red-700"}`} role={ok ? "status" : "alert"}>{msg}</p>}
        <button type="submit" aria-disabled={loading || undefined} aria-busy={loading || undefined} className="btn-primary w-full min-h-[44px] aria-disabled:opacity-60 aria-disabled:cursor-wait">
          {loading ? "שומר..." : "שמירה"}
        </button>
      </form>
      <button onClick={logout} aria-disabled={leaving || undefined} className="card w-full text-sm text-red-700 font-semibold min-h-[44px]">
        {leaving ? "מתנתק..." : "יציאה מהחשבון"}
      </button>
      <p className="text-xs text-gray-600 text-center">
        גרסה <span dir="ltr" className="tabular-nums">{APP_VERSION}</span> ·{" "}
        <Link href="/changelog" className="underline text-brand-700 inline-flex items-center min-h-[44px]">גרסאות ושינויים</Link>
      </p>
    </div>
  );
}
