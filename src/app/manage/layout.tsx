import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentAppUser();
  if (!user || user.role !== "admin") redirect("/dashboard");
  return <>{children}</>;
}
