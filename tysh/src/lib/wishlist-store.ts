"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CropStrategy } from "@/lib/types";

/** Snapshot of what is needed to render a saved piece without a server round trip. */
export interface WishlistItem {
  productId: string;
  slug: string;
  brand: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  colour: string;
  hex: string;
  image: { id: string; alt: string; crop: CropStrategy };
  tone: string;
  savedAt: string;
}

interface WishlistState {
  items: WishlistItem[];
  hydrated: boolean;
  toggle: (item: Omit<WishlistItem, "savedAt">) => boolean;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      /** Returns true when the item was added, false when removed. */
      toggle: (item) => {
        const exists = get().items.some((i) => i.productId === item.productId);
        set((s) => ({
          items: exists ? s.items.filter((i) => i.productId !== item.productId) : [{ ...item, savedAt: new Date().toISOString() }, ...s.items],
        }));
        return !exists;
      },
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      has: (productId) => get().items.some((i) => i.productId === productId),
    }),
    {
      name: "tysh-wishlist",
      version: 1,
      storage: createJSONStorage(() => (typeof window === "undefined" ? (undefined as unknown as Storage) : window.localStorage)),
      partialize: (s) => ({ items: s.items }),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useWishlist.setState({ hydrated: true });
      },
    },
  ),
);
