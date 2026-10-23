"use client";

import Link from "next/link";
import { useState } from "react";

export type TickerItem = { id: string; title: string; is_important: boolean };

// News-style strip. Motion is CSS-only and is disabled entirely under prefers-reduced-motion
// (then the headlines are shown as a plain static list). Pauses on hover, on keyboard/touch focus
// inside the strip, and via an explicit pause button.
export default function NewsTicker({ items }: { items: TickerItem[] }) {
  const [paused, setPaused] = useState(false);
  if (!items.length) return null;

  const chars = items.reduce((n, i) => n + i.title.length + 8, 0);
  const duration = `${Math.max(15, Math.round(chars * 0.25))}s`;

  const list = (hidden: boolean) => (
    <ul className="flex items-center gap-6 pe-6 motion-reduce:flex-col motion-reduce:items-start motion-reduce:gap-2 motion-reduce:pe-0" aria-hidden={hidden || undefined}>
      {items.map((a) => (
        <li key={a.id} className="whitespace-nowrap motion-reduce:whitespace-normal">
          <Link
            href="/announcements"
            tabIndex={hidden ? -1 : undefined}
            className={`inline-flex items-center gap-1.5 min-h-[44px] rounded-lg px-2 text-sm ${
              a.is_important ? "bg-amber-100 text-amber-900 font-bold" : "text-gray-800"
            }`}
          >
            {a.is_important && <span aria-hidden="true">📌</span>}
            {a.is_important && <span className="text-xs">חשוב:</span>}
            {a.title}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <section
      aria-label="מבזק הודעות הבניין"
      className="ticker card !p-0 flex items-stretch overflow-hidden border border-brand-200"
    >
      <span className="shrink-0 bg-brand-600 text-white text-xs font-bold px-3 flex items-center">📢 הודעות</span>
      <div className="flex-1 min-w-0 overflow-hidden relative">
        <div
          className="ticker-track flex w-max motion-reduce:w-auto motion-reduce:block"
          style={{ animationDuration: duration, animationPlayState: paused ? "paused" : undefined }}
        >
          {list(false)}
          <div className="motion-reduce:hidden">{list(true)}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "המשך גלילת ההודעות" : "עצור גלילת ההודעות"}
        className="ticker-btn shrink-0 min-w-[44px] min-h-[44px] px-3 text-sm font-semibold text-brand-700 border-s border-gray-200 bg-white motion-reduce:hidden"
      >
        {paused ? "המשך" : "עצור"}
      </button>
    </section>
  );
}
