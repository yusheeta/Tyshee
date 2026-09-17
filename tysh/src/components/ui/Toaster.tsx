"use client";

import Link from "next/link";
import { useToasts } from "@/lib/toast-store";
import { CloseIcon } from "./Icons";

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-4 border border-line bg-paper px-4 py-3 text-sm text-ink shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)]">
          <span>{t.message}</span>
          {t.action && (
            <Link href={t.action.href} onClick={() => dismiss(t.id)} className="eyebrow link-underline text-ink">
              {t.action.label}
            </Link>
          )}
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 flex h-6 w-6 items-center justify-center text-stone hover:text-ink">
            <CloseIcon width={14} height={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
