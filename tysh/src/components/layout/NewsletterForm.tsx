"use client";

import { useActionState } from "react";
import { subscribeNewsletter, type NewsletterState } from "@/lib/actions/newsletter";
import { ArrowIcon } from "@/components/ui/Icons";

const initial: NewsletterState = { ok: false, message: "" };

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletter, initial);
  return (
    <form action={action} className="max-w-md">
      <label htmlFor="newsletter-email" className="eyebrow block">
        Newsletter
      </label>
      <p className="mt-3 font-serif text-2xl leading-snug">Occasional letters on new pieces, colour and the atelier.</p>
      <div className="mt-6 flex items-end gap-4">
        <input id="newsletter-email" name="email" type="email" required autoComplete="email" placeholder="Email address" className="field" disabled={state.ok} />
        <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center border border-ink transition hover:bg-ink hover:text-paper disabled:opacity-40" aria-label="Subscribe" disabled={pending || state.ok}>
          <ArrowIcon />
        </button>
      </div>
      <p className="mt-3 min-h-5 text-xs text-stone" role="status" aria-live="polite">
        {state.message}
      </p>
    </form>
  );
}
