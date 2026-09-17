"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-store";
import { useColourProfile } from "@/lib/colour/profile-store";
import { useWishlist } from "@/lib/wishlist-store";

/** Rehydrates persisted client stores after mount. Renders nothing. */
export function CartHydration() {
  useEffect(() => {
    void useCart.persist.rehydrate();
    void useColourProfile.persist.rehydrate();
    void useWishlist.persist.rehydrate();
  }, []);
  return null;
}
