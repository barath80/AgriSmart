"use client";

import { type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/types";

const initial: ActionState = { ok: true, message: "" };

/** A form bound to a server action, with a pending state and an accessible result message. */
export function ActionForm({
  action,
  children,
  className = "",
  submitLabel,
  submitClassName,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  submitLabel: string;
  submitClassName?: string;
}) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={submitLabel} className={submitClassName} />
        {state.message ? (
          <p role="status" className={`text-sm ${state.ok ? "text-good" : "text-critical"}`}>
            {state.ok ? "✓ " : "✕ "}
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function SubmitButton({ label, className = "" }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`h-9 rounded-lg bg-brand px-4 text-sm font-medium text-brand-contrast disabled:opacity-60 ${className}`}
    >
      {pending ? "Working…" : label}
    </button>
  );
}
