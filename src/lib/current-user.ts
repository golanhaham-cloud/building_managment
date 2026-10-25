import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";

// cache(): the layout, the page and server actions in one request share a single lookup instead of repeating two network calls.
export const getCurrentAppUser = cache(async (): Promise<AppUser | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("app_users")
    .select("id, auth_id, resident_id, building_id, role")
    .eq("auth_id", user.id)
    .single();

  return data as AppUser | null;
});
