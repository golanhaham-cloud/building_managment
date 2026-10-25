import { createClient } from "@/lib/supabase/server";
import ClaimForm from "./ClaimForm";
import JoinStatus from "./JoinStatus";

export const dynamic = "force-dynamic";

// Server component: decides what a signed-in user without building access sees.
// No building data is read here; only the user's own join request (RPC returns own row only).
export default async function ClaimPage() {
  const supabase = createClient();
  const { data } = await supabase.rpc("my_join_request");
  const req = Array.isArray(data) ? data[0] : null;
  if (req && (req.status === "pending" || req.status === "rejected")) {
    return <JoinStatus status={req.status} email={req.email} requestedAt={req.requested_at} />;
  }
  return <ClaimForm />;
}
