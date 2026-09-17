"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; href: string };
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, action?: Toast["action"]) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

/** Short, unobtrusive confirmations after an action (added to bag, saved, removed). */
export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  push: (message, action) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, action }] }));
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3600);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, action?: Toast["action"]) => useToasts.getState().push(message, action);
