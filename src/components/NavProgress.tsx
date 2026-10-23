"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getServerSnapshot, getSnapshot, rsc, startNav, stopNav, subscribe } from "@/lib/nav-store";

const SKIP_PREFIXES = ["/files/", "/auth/"]; // downloads / file gateway / auth redirects: not page loads

function shouldTrack(a: HTMLAnchorElement, e: MouseEvent): string | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  if (a.hasAttribute("download") || a.hasAttribute("data-no-progress")) return null;
  const target = a.getAttribute("target");
  if (target && target !== "_self") return null;
  let u: URL;
  try { u = new URL(a.href, window.location.href); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null; // tel:, mailto:, javascript: ...
  if (u.origin !== window.location.origin) return null; // external
  if (SKIP_PREFIXES.some((p) => u.pathname.startsWith(p))) return null;
  const next = u.pathname + u.search;
  if (next === window.location.pathname + window.location.search) return null; // same page / hash only
  return next;
}

export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { key, slow, failed } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Navigation finished -> clear. A new path means the destination (or its loading skeleton) is on screen.
  // A query-only change updates the URL first and the content later, so then we wait for the page fetch to settle.
  const prevPath = useRef(pathname);
  useEffect(() => {
    const pathChanged = prevPath.current !== pathname;
    prevPath.current = pathname;
    if (pathChanged || rsc.inflight === 0) stopNav();
  }, [pathname, search]);

  // Observe (never alter) Next's own page-data fetches so query-only navigations end when their data arrives.
  useEffect(() => {
    const orig = window.fetch;
    const isPageFetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const h = new Headers(init?.headers ?? (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined));
      return h.get("RSC") === "1" && !h.get("Next-Router-Prefetch");
    };
    window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      const p = orig.call(window, input, init);
      let tracked = false;
      try { tracked = isPageFetch(input, init); } catch { /* ignore */ }
      if (tracked) {
        rsc.inflight++; rsc.seen = true;
        const done = () => {
          rsc.inflight = Math.max(0, rsc.inflight - 1);
          if (rsc.inflight === 0) setTimeout(() => { if (rsc.inflight === 0 && rsc.seen) stopNav(); }, 250);
        };
        p.then(done, done);
      }
      return p;
    } as typeof window.fetch;
    return () => { window.fetch = orig; };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const k = shouldTrack(a, e);
      if (k) startNav(k);
    };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      if (!(f instanceof HTMLFormElement) || (f.method || "get").toLowerCase() !== "get" || f.target) return;
      startNav(f.action || window.location.href); // plain GET form = full page navigation
    };
    const onPageShow = () => stopNav(); // back/forward cache restore
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  useEffect(() => {
    const m = document.querySelector("main");
    if (key) m?.setAttribute("aria-busy", "true"); else m?.removeAttribute("aria-busy");
  }, [key]);

  return (
    <div aria-live="polite" role="status" className="pointer-events-none">
      {key && (
        <>
          <div className="fixed top-0 inset-x-0 z-[60] h-1 bg-brand-100 overflow-hidden" aria-hidden="true">
            <div className="nav-progress-bar h-full w-1/3 bg-brand-600" />
          </div>
          <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-brand-700 text-white text-xs font-semibold px-3 py-1 shadow flex items-center gap-2">
            <span className="nav-spinner inline-block w-3 h-3 rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            {slow ? "הטעינה מתארכת, עדיין ממתין…" : "טוען…"}
          </div>
        </>
      )}
      {failed && (
        <div role="alert" className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] rounded-xl bg-red-700 text-white text-sm font-semibold px-4 py-2 shadow">
          המעבר לעמוד לא הושלם. בדוק/י את החיבור ונסה/י שוב.
        </div>
      )}
    </div>
  );
}
