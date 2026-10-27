"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe } from "@/lib/nav-store";
import { TABS, activeTab } from "@/lib/nav";
import type { UserRole } from "@/lib/types";

// אותם חמישה פריטים לדייר ולוועד. התפקיד אינו משנה את הניווט; ההרשאות נאכפות בעמודים עצמם.
export default function BottomNav({ role: _role }: { role: UserRole }) {
  const pathname = usePathname();
  const nav = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const current = activeTab(pathname);

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-20">
      <div className={`mx-auto max-w-3xl grid grid-cols-5 text-xs`}>
        {TABS.map((item) => {
          const active = current === item.id;
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
