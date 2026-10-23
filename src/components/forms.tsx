"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

export type ActionState = { ok: boolean; message: string } | null;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({
  children,
  className,
  confirmText,
  pendingText = "שומר...",
}: {
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  // aria-disabled (not disabled) keeps keyboard focus on the button while saving; extra clicks are swallowed.
  return (
    <button
      type="submit"
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      onClick={(e) => {
        if (pending) return e.preventDefault();
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className={`${className ?? "btn-primary w-full text-sm py-2.5 min-h-[44px]"} aria-disabled:opacity-60 aria-disabled:cursor-wait`}
    >
      {pending && <span className="nav-spinner inline-block w-3 h-3 me-1.5 align-middle rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {pending ? pendingText : children}
    </button>
  );
}

function newKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return "";
  }
}

export function ActionForm({
  action,
  children,
  className,
  keepOnSuccess,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  keepOnSuccess?: boolean;
}) {
  // A thrown error (dropped connection, server crash) must not blank the page or lose the typed values:
  // it becomes an inline Hebrew error and the form stays as it was, ready for a retry.
  const safeAction: Action = async (prev, fd) => {
    try {
      return await action(prev, fd);
    } catch {
      return { ok: false, message: "הפעולה לא הושלמה, ייתכן שיש בעיית חיבור. בדוק/י את החיבור ונסה/י שוב. מה שהוזן נשמר בטופס." };
    }
  };
  const [state, formAction] = useFormState(safeAction, null as ActionState);
  const [key, setKey] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  // Synchronous double-submit guard: React's pending state renders a moment after the first submit,
  // so a very fast second tap/Enter could otherwise slip through. Released when the action returns.
  const inFlight = useRef(false);

  useEffect(() => {
    setKey(newKey());
  }, []);

  useEffect(() => {
    inFlight.current = false;
  }, [state]);

  useEffect(() => {
    if (state?.ok) {
      if (!keepOnSuccess) ref.current?.reset();
      setKey(newKey());
    }
  }, [state, keepOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      onSubmit={(e) => {
        if (inFlight.current) e.preventDefault();
        else inFlight.current = true;
      }}
      className={className ?? "space-y-2"}
    >
      <input type="hidden" name="idempotency_key" value={key} />
      {children}
      {state && (
        <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
