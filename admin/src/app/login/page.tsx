import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface-1 p-8">
        <p className="text-3xl" aria-hidden>🌱</p>
        <h1 className="mt-2 text-xl font-semibold">AgriSmart Admin</h1>
        <p className="mt-1 text-sm text-ink-2">Sign in with your administrator account.</p>
        <LoginForm />
      </div>
    </main>
  );
}
