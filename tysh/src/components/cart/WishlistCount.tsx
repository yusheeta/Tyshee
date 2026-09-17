"use client";

import Link from "next/link";
import { HeartIcon } from "@/components/ui/Icons";
import { useWishlist } from "@/lib/wishlist-store";

export function WishlistCount({ className }: { className?: string }) {
  const count = useWishlist((s) => (s.hydrated ? s.items.length : 0));
  return (
    <Link href="/wishlist" className={className} aria-label={`Wishlist, ${count} saved`}>
      <HeartIcon filled={count > 0} />
      {count > 0 && <span className="eyebrow tabular-nums text-ink">({count})</span>}
    </Link>
  );
}
