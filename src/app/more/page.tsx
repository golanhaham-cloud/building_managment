import { getCurrentAppUser } from "@/lib/current-user";
import MoreMenu from "@/components/MoreMenu";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const user = await getCurrentAppUser();
  return <MoreMenu isAdmin={user?.role === "admin"} title="עוד" />;
}
