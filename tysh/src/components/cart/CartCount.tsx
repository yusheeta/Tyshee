"use client";

import Link from "next/link";
import { cartTotals, useCart } from "@/lib/cart-store";
import { BagIcon } from "@/components/ui/Icons";

export function CartCount({ className }: { className?: string }) {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const { count } = cartTotals(items);
  return (
    <Link href="/cart" className={className}>
      <BagIcon />
      <span className="eyebrow hidden text-ink lg:inline">Bag</span>
      <span className="eyebrow min-w-[1.25rem] text-ink tabular-nums">
        {hydrated && count > 0 ? `(${count})` : ""}
      </span>
      <span className="sr-only">{hydrated && count > 0 ? `, ${count} ${count === 1 ? "item" : "items"}` : "Shopping bag"}</span>
    </Link>
  );
}
