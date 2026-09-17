"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_QTY, shippingFor } from "@/lib/shipping";
import type { CropStrategy } from "@/lib/types";

export interface CartItem {
  /** productId|colour|size */
  key: string;
  productId: string;
  slug: string;
  name: string;
  price: number;
  colour: string;
  size: string;
  image: { id: string; alt: string; crop: CropStrategy };
  tone: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  hydrated: boolean;
  lastAdded: CartItem | null;
  add: (item: Omit<CartItem, "key" | "qty">, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  dismissLastAdded: () => void;
}

export { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING, MAX_QTY } from "@/lib/shipping";

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      hydrated: false,
      lastAdded: null,
      add: (item, qty = 1) =>
        set((state) => {
          const key = `${item.productId}|${item.colour}|${item.size}`;
          const existing = state.items.find((i) => i.key === key);
          const items = existing
            ? state.items.map((i) => (i.key === key ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i))
            : [...state.items, { ...item, key, qty }];
          return { items, lastAdded: items.find((i) => i.key === key) ?? null };
        }),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      setQty: (key, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.key !== key)
              : s.items.map((i) => (i.key === key ? { ...i, qty: Math.min(MAX_QTY, qty) } : i)),
        })),
      clear: () => set({ items: [], lastAdded: null }),
      dismissLastAdded: () => set({ lastAdded: null }),
    }),
    {
      name: "tysh-cart",
      version: 1,
      storage: createJSONStorage(() => (typeof window === "undefined" ? (undefined as unknown as Storage) : window.localStorage)),
      partialize: (s) => ({ items: s.items }),
      // Rehydrate after mount so server HTML and the first client render agree.
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useCart.setState({ hydrated: true });
      },
    },
  ),
);

export function cartTotals(items: CartItem[]) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = shippingFor(subtotal);
  const count = items.reduce((s, i) => s + i.qty, 0);
  return { subtotal, shipping, total: subtotal + shipping, count };
}
