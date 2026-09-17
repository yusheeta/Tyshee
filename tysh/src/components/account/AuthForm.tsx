"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, type AuthState } from "@/lib/auth/actions";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : register, { error: null });
  const alt = mode === "login" ? { href: `/register?next=${encodeURIComponent(next)}`, label: "Create an account" } : { href: `/login?next=${encodeURIComponent(next)}`, label: "Sign in instead" };

  return (
    <form action={action} className="mt-10 space-y-6">
      <input type="hidden" name="next" value={next} />
      {mode === "register" && (
        <div>
          <label htmlFor="name" className="eyebrow block">Name</label>
          <input id="name" name="name" required autoComplete="name" className="field mt-1" />
        </div>
      )}
      <div>
        <label htmlFor="email" className="eyebrow block">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field mt-1" />
      </div>
      <div>
        <label htmlFor="password" className="eyebrow block">Password</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} className="field mt-1" />
        {mode === "register" && <p className="mt-1 text-xs text-stone">At least 8 characters.</p>}
      </div>
      {state.error && (
        <p className="text-sm text-oxblood" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn w-full">
        {pending ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
      <p className="text-center text-sm text-stone">
        <Link href={alt.href} className="link-underline text-ink">
          {alt.label}
        </Link>
      </p>
    </form>
  );
}
