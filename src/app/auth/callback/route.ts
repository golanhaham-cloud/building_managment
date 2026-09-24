import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(
          "הקישור לא תקף יותר, כנראה כי הוא נפתח בדפדפן אחר מזה שביקש אותו. בקש/י קישור חדש ופתח/י אותו ב-Safari."
        )}`
      );
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
