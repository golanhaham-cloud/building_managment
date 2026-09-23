import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { getCurrentAppUser } from "@/lib/current-user";

export const metadata: Metadata = {
  title: "ליבנה 6 - ניהול הבניין",
  description: "מערכת שקיפות וניהול לבניין ליבנה 6",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAppUser();

  return (
    <html lang="he" dir="rtl">
      <body>
        <div className="mx-auto max-w-3xl min-h-screen pb-20">{children}</div>
        {user && <BottomNav role={user.role} />}
      </body>
    </html>
  );
}
