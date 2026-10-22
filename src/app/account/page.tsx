"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setMsg("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return;
    }
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    setMsg(error ? "שגיאה: " + error.message : "הסיסמה עודכנה.");
    if (!error) setPassword("");
  }

  async function logout() {
    await createClient().auth.signOut();
    window.location.href = "/login";
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
        {msg && <p className="text-sm">{msg}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "רגע..." : "שמירה"}
        </button>
      </form>
      <button onClick={logout} className="card w-full text-sm text-red-700 font-semibold">
        יציאה מהחשבון
      </button>
    </div>
  );
}
