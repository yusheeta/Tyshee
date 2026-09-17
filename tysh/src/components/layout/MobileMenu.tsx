"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/Icons";
import { CurrencySelector } from "./CurrencySelector";
import { ThemeToggle } from "./ThemeToggle";

interface Item {
  href: string;
  label: string;
}

export function MobileMenu({ primary, secondary }: { primary: Item[]; secondary: Item[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="-ml-2 flex h-10 w-10 items-center justify-center lg:hidden" aria-label="Open menu" aria-expanded={open}>
        <MenuIcon />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-16 items-center justify-between px-5">
            <span className="font-serif text-2xl tracking-[0.3em]">TYSHEE</span>
            <button type="button" onClick={() => setOpen(false)} className="-mr-2 flex h-10 w-10 items-center justify-center" aria-label="Close menu">
              <CloseIcon />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-5 pb-10 pt-6">
            <ul className="space-y-5">
              {primary.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} onClick={() => setOpen(false)} className="display text-4xl">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-10 border-t border-line pt-6">
              <CurrencySelector labelled />
            </div>
            <ThemeToggle variant="row" className="mt-8" />
            <ul className="mt-8 space-y-4 border-t border-line pt-8">
              {secondary.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} onClick={() => setOpen(false)} className="eyebrow text-ink">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
