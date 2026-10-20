"use client";

import { useActionState } from "react";

import { login } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms";
import type { ActionState } from "@/lib/types";

export function LoginForm() {
  const [state, action] = useActionState<ActionState, FormData>(login, { ok: true, message: "" });
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        E-mail
        <input name="email" type="email" autoComplete="username" required
               className="h-10 rounded-lg border border-line bg-surface-1 px-3 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Password
        <input name="password" type="password" autoComplete="current-password" required minLength={8}
               className="h-10 rounded-lg border border-line bg-surface-1 px-3 text-sm" />
      </label>
      {!state.ok ? <p role="alert" className="text-sm text-critical">✕ {state.message}</p> : null}
      <SubmitButton label="Sign in" className="h-10 w-full" />
    </form>
  );
}
