// Tiny external store for "a navigation is in flight" state. No dependency; read with useSyncExternalStore.
type Snap = { key: string | null; slow: boolean; failed: boolean };
let snap: Snap = { key: null, slow: false, failed: false };
const subs = new Set<() => void>();
let slowTimer: ReturnType<typeof setTimeout> | undefined;
let failTimer: ReturnType<typeof setTimeout> | undefined;
let clearFailTimer: ReturnType<typeof setTimeout> | undefined;

const emit = () => subs.forEach((f) => f());
const set = (s: Snap) => { snap = s; emit(); };

export const SLOW_MS = 8000;
export const GIVE_UP_MS = 25000;

// In-flight (non-prefetch) RSC page fetches, maintained by NavProgress. Used to decide when a navigation
// that only changed the query string is really finished: the URL changes first, the content arrives later.
export const rsc = { inflight: 0, seen: false };

export function startNav(key: string) {
  rsc.seen = false;
  clearTimeout(slowTimer); clearTimeout(failTimer); clearTimeout(clearFailTimer);
  set({ key, slow: false, failed: false });
  slowTimer = setTimeout(() => snap.key && set({ ...snap, slow: true }), SLOW_MS);
  // Safety net: a navigation that never completes (cancelled, dropped connection) must not leave the UI stuck.
  failTimer = setTimeout(() => {
    if (!snap.key) return;
    set({ key: null, slow: false, failed: true });
    clearFailTimer = setTimeout(() => set({ key: null, slow: false, failed: false }), 6000);
  }, GIVE_UP_MS);
}

export function stopNav() {
  clearTimeout(slowTimer); clearTimeout(failTimer);
  if (snap.key || snap.slow) set({ key: null, slow: false, failed: false });
}

export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const getSnapshot = () => snap;
const server: Snap = { key: null, slow: false, failed: false };
export const getServerSnapshot = () => server;
