import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import BottomNav from "@/components/BottomNav";
import NavProgress from "@/components/NavProgress";
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
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <main className="mx-auto max-w-3xl min-h-screen pb-24">{children}</main>
        {user && <BottomNav role={user.role} />}
      </body>
    </html>
  );
}
