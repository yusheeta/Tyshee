"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-store";

/** Empties the local bag once an order is confirmed paid. */
export function ClearCart() {
  useEffect(() => {
    const done = () => useCart.getState().clear();
    if (useCart.getState().hydrated) done();
    else {
      const unsub = useCart.subscribe((s) => {
        if (s.hydrated) {
          done();
          unsub();
        }
      });
      return unsub;
    }
  }, []);
  return null;
}
