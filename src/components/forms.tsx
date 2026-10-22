"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

export type ActionState = { ok: boolean; message: string } | null;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({
  children,
  className,
  confirmText,
}: {
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className={className ?? "btn-primary w-full text-sm py-2.5 min-h-[44px] disabled:opacity-60"}
    >
      {pending ? "שומר..." : children}
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
  const [state, formAction] = useFormState(action, null as ActionState);
  const [key, setKey] = useState("");
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setKey(newKey());
  }, []);

  useEffect(() => {
    if (state?.ok) {
      if (!keepOnSuccess) ref.current?.reset();
      setKey(newKey());
    }
  }, [state, keepOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className ?? "space-y-2"}>
      <input type="hidden" name="idempotency_key" value={key} />
      {children}
      {state && (
        <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
