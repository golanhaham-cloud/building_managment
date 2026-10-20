"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

const CLAIM_ERRORS: Record<string, string> = {
  email_not_found: "המייל הזה לא רשום ברשימת הדיירים. פנה/י לוועד כדי שיעדכנו אותו.",
  bad_code: "קוד הבניין שגוי.",
  no_session: "ההרשמה לא הושלמה, נסה/י להתחבר.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup" | "link">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setError(err);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "link") {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (error) setError("שליחת הקישור נכשלה, נסה שוב.");
      else setSent(true);
      return;
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        setLoading(false);
        setError("מייל או סיסמה שגויים.");
        return;
      }
      window.location.href = "/dashboard";
      return;
    }

    // signup
    if (password.length < 6) {
      setLoading(false);
      setError("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return;
    }
    const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
    if (error) {
      setLoading(false);
      setError("ההרשמה נכשלה: " + error.message);
      return;
    }
    if (!data.session) {
      setLoading(false);
      setError("לא ניתן להשלים הרשמה. אם כבר נרשמת, עבר/י ל'כניסה'.");
      return;
    }
    const { data: result } = await supabase.rpc("claim_resident_account", { p_code: code });
    if (result !== "ok") {
      setLoading(false);
      setError(CLAIM_ERRORS[result as string] ?? "ההרשמה נכשלה.");
      return;
    }
    window.location.href = "/dashboard";
  }

  const title = mode === "login" ? "כניסה" : mode === "signup" ? "הרשמה (פעם ראשונה)" : "כניסה בקישור למייל";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-4xl mb-2">🏢</div>
      <h1 className="text-2xl font-extrabold mb-1">ליבנה 6</h1>
      <p className="text-gray-500 mb-6">מערכת ניהול ושקיפות הבניין</p>

      {sent ? (
        <div className="card w-full max-w-sm text-center">
          <p className="font-semibold mb-1">שלחנו לך קישור התחברות</p>
          <p className="text-sm text-gray-500">בדוק/י את תיבת המייל (גם בספאם) ולחצ/י על הקישור.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-3">
          <div className="font-bold">{title}</div>
          <label className="block text-sm font-medium text-gray-700">כתובת מייל</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-right"
            dir="ltr"
          />
          {mode !== "link" && (
            <>
              <label className="block text-sm font-medium text-gray-700">
                {mode === "signup" ? "בחר/י סיסמה (לפחות 6 תווים)" : "סיסמה"}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-right"
                dir="ltr"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </>
          )}
          {mode === "signup" && (
            <>
              <label className="block text-sm font-medium text-gray-700">קוד הבניין (מקבלים מהוועד)</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-right"
                dir="ltr"
              />
            </>
          )}
          {error && <p className="text-sm text-status-unpaid">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "רגע..." : mode === "login" ? "כניסה" : mode === "signup" ? "הרשמה" : "שלח/י לי קישור"}
          </button>
          <div className="flex flex-col gap-1 text-sm text-brand-600 text-center pt-1">
            {mode !== "login" && (
              <button type="button" onClick={() => { setMode("login"); setError(null); }}>
                יש לי חשבון - כניסה
              </button>
            )}
            {mode !== "signup" && (
              <button type="button" onClick={() => { setMode("signup"); setError(null); }}>
                פעם ראשונה? הרשמה עם קוד הבניין
              </button>
            )}
            {mode !== "link" && (
              <button type="button" onClick={() => { setMode("link"); setError(null); }}>
                כניסה בקישור למייל
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
