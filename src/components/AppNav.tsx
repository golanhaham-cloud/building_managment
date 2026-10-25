import BottomNav from "@/components/BottomNav";
import { getCurrentAppUser } from "@/lib/current-user";

// The bottom navigation needs the signed-in user. It is rendered inside its own Suspense boundary so the root layout
// (html/body, splash, page shell) can stream to the browser without waiting for this lookup.
export default async function AppNav() {
  const user = await getCurrentAppUser();
  return user ? <BottomNav role={user.role} /> : null;
}
