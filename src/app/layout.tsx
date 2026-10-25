import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import AppNav from "@/components/AppNav";
import NavProgress from "@/components/NavProgress";
import Splash from "@/components/Splash";

export const metadata: Metadata = {
  title: "ליבנה 6 - ניהול הבניין",
  description: "מערכת שקיפות וניהול לבניין ליבנה 6",
};

const FONT_URL = "https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&display=swap";
// Loads the font stylesheet without blocking first paint (it used to be a CSS @import, which delayed rendering).
const FONT_SCRIPT = `(function(){var l=document.getElementById('font-css');if(!l)return;var f=function(){l.media='all';};l.addEventListener('load',f);setTimeout(f,3000);})();`;

// The layout itself no longer waits for the user lookup: html/body, the splash and the page shell stream immediately,
// and the user-dependent bottom navigation fills in through its own Suspense boundary.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta name="theme-color" content="#f0f6f5" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link id="font-css" rel="stylesheet" href={FONT_URL} media="print" suppressHydrationWarning />
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: FONT_SCRIPT }} />
        <noscript>
          <link rel="stylesheet" href={FONT_URL} />
        </noscript>
      </head>
      <body>
        <Splash />
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <main className="mx-auto max-w-3xl min-h-screen pb-24">{children}</main>
        <Suspense fallback={null}>
          <AppNav />
        </Suspense>
      </body>
    </html>
  );
}
