"use client";

import { useEffect, useRef, useState } from "react";
import { LampIcon, MoonIcon, SunIcon } from "@/components/ui/Icons";
import { setTheme, THEMES, useTheme, type Theme } from "@/lib/theme-store";
import { cn } from "@/lib/utils";

const ICON: Record<Theme, typeof SunIcon> = { light: SunIcon, dark: MoonIcon, night: LampIcon };

/** Light, dark or night-light. A compact menu in the header; a labelled row in the mobile menu. */
export function ThemeToggle({ variant = "menu", className }: { variant?: "menu" | "row"; className?: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Icon = ICON[theme];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (variant === "row") {
    return (
      <div className={className}>
        <p className="eyebrow">Appearance</p>
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Appearance">
          {THEMES.map((t) => {
            const I = ICON[t.id];
            return (
              <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} onClick={() => setTheme(t.id)} className={cn("flex flex-col items-center gap-2 border p-3 text-xs transition", theme === t.id ? "border-ink" : "border-line hover:border-stone")}>
                <I width={18} height={18} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Appearance: ${THEMES.find((t) => t.id === theme)?.label}`} className="-m-2 flex h-10 w-10 items-center justify-center">
        <Icon />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-48 border border-line bg-paper p-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.3)]">
          {THEMES.map((t) => {
            const I = ICON[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={theme === t.id}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-bone", theme === t.id && "bg-bone")}
              >
                <I width={16} height={16} />
                <span>
                  <span className="block">{t.label}</span>
                  <span className="block text-xs text-stone">{t.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
