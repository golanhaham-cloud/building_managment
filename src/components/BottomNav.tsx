"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

const items = [
  { href: "/dashboard", label: "ראשי", icon: "🏠" },
  { href: "/finances", label: "כספים", icon: "💰" },
  { href: "/apartments", label: "דיירים", icon: "🏢" },
  { href: "/requests", label: "תקלות", icon: "🔧" },
  { href: "/projects", label: "תוכניות", icon: "📋" },
  { href: "/announcements", label: "הודעות", icon: "📢" },
];

export default function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-20">
      <div className="mx-auto max-w-3xl grid grid-cols-6 text-[11px]">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 ${
                active ? "text-brand-600 font-bold" : "text-gray-500"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
