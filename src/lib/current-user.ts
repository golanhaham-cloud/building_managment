import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";

export async function getCurrentAppUser(): Promise<AppUser | null> {
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
}
