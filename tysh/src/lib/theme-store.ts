"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "night";
export const THEMES: { id: Theme; label: string; description: string }[] = [
  { id: "light", label: "Light", description: "Paper and ink" },
  { id: "dark", label: "Dark", description: "Low light" },
  { id: "night", label: "Night light", description: "Warm, less blue light" },
];
const KEY = "tysh-theme";
const listeners = new Set<() => void>();

function read(): Theme {
  if (typeof document === "undefined") return "light";
  const t = document.documentElement.getAttribute("data-theme");
  return t === "dark" || t === "night" ? t : "light";
}

export function setTheme(theme: Theme) {
  if (theme === "light") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // storage unavailable: theme still applies for this page
  }
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    read,
    () => "light",
  );
}
