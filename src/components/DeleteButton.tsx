"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteItem, restoreItem } from "@/lib/delete-actions";

type Kind = "announcement" | "request";

// Soft delete with a confirmation dialog. The server (database) decides whether the user may delete; the button
// is only shown when the page already knows they may. Success is shown only after the server confirmed it.
export function DeleteButton({ kind, id, title, redirectTo, className }: { kind: Kind; id: string; title: string; redirectTo?: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const noun = kind === "announcement" ? "ההודעה" : "התקלה";

  useEffect(() => {
    if (open) cancelBtn.current?.focus();
  }, [open]);

  function close() {
    if (inFlight.current) return;
    setOpen(false);
    setError(null);
    trigger.current?.focus();
  }

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const r = await deleteItem(kind, id);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      setError("אירעה שגיאת חיבור, הפריט לא נמחק. נסה/י שוב.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "inline-flex items-center min-h-[44px] px-3 rounded-lg border border-red-300 text-red-700 text-sm font-semibold"}
      >
        🗑️ מחיקה
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onKeyDown={(e) => { if (e.key === "Escape") close(); }}
        >
          <div role="alertdialog" aria-modal="true" aria-labelledby={`del-t-${id}`} aria-describedby={`del-d-${id}`} className="bg-white rounded-2xl p-4 w-full max-w-sm space-y-3 shadow-xl">
            <h2 id={`del-t-${id}`} className="font-bold break-words">מחיקת {noun}: {title}</h2>
            <p id={`del-d-${id}`} className="text-sm text-gray-700">הפריט יוסר מהרשימות. הוועד יוכל לשחזר אותו.</p>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirm}
                aria-disabled={pending || undefined}
                aria-busy={pending || undefined}
                className="flex-1 min-h-[44px] rounded-xl bg-red-700 text-white font-semibold aria-disabled:opacity-60 aria-disabled:cursor-wait"
              >
                {pending ? "מוחק..." : "מחיקה"}
              </button>
              <button
                ref={cancelBtn}
                type="button"
                onClick={close}
                aria-disabled={pending || undefined}
                className="flex-1 min-h-[44px] rounded-xl border border-gray-300 font-semibold aria-disabled:opacity-60"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function RestoreButton({ kind, id }: { kind: Kind; id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function go() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const r = await restoreItem(kind, id);
      if (!r.ok) setError(r.message);
      else router.refresh();
    } catch {
      setError("אירעה שגיאת חיבור, הפריט לא שוחזר. נסה/י שוב.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <button type="button" onClick={go} aria-disabled={pending || undefined} aria-busy={pending || undefined} className="btn-primary text-sm min-h-[44px] px-5 aria-disabled:opacity-60 aria-disabled:cursor-wait">
        {pending ? "משחזר..." : "שחזור"}
      </button>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
