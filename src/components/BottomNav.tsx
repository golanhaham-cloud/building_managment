"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe } from "@/lib/nav-store";
import type { UserRole } from "@/lib/types";

const items = [
  { href: "/dashboard", label: "ראשי", icon: "🏠" },
  { href: "/finances", label: "כספים", icon: "💰" },
  { href: "/forecast", label: "תחזית", icon: "📈" },
  { href: "/apartments", label: "דיירים", icon: "🏢" },
  { href: "/requests", label: "תקלות", icon: "🔧" },
  { href: "/projects", label: "תוכניות", icon: "📋" },
  { href: "/announcements", label: "הודעות", icon: "📢" },
  { href: "/account", label: "חשבון", icon: "👤" },
];

const adminItems = [
  { href: "/dashboard", label: "ראשי", icon: "🏠" },
  { href: "/finances", label: "כספים", icon: "💰" },
  { href: "/forecast", label: "תחזית", icon: "📈" },
  { href: "/apartments", label: "דיירים", icon: "🏢" },
  { href: "/requests", label: "תקלות", icon: "🔧" },
  { href: "/manage", label: "ניהול", icon: "⚙️" },
];

export default function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const nav = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const list = role === "admin" ? adminItems : items;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-20">
      <div className={`mx-auto max-w-3xl grid ${role === "admin" ? "grid-cols-6" : "grid-cols-8"} text-[11px] sm:text-xs`}>
        {list.map((item) => {
          const active = pathname.startsWith(item.href);
          const pending = !!nav.key && (nav.key === item.href || nav.key.startsWith(item.href + "/") || nav.key.startsWith(item.href + "?"));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-busy={pending || undefined}
              className={`flex flex-col items-center gap-0.5 py-2 min-h-[52px] relative ${
                pending ? "bg-brand-50 text-brand-700 font-bold" : active ? "text-brand-600 font-bold" : "text-gray-500"
              }`}
            >
              {pending ? (
                <span className="nav-spinner inline-block w-5 h-5 rounded-full border-2 border-brand-200 border-t-brand-600" aria-hidden="true" />
              ) : (
                <span className="text-lg leading-none">{item.icon}</span>
              )}
              {pending ? "טוען…" : item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
