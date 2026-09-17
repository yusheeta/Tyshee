"use client";

import { HeartIcon } from "@/components/ui/Icons";
import { toast } from "@/lib/toast-store";
import type { CropStrategy } from "@/lib/types";
import { useWishlist, type WishlistItem } from "@/lib/wishlist-store";
import { cn } from "@/lib/utils";

interface Props {
  item: Omit<WishlistItem, "savedAt">;
  className?: string;
  /** Icon-only (cards) or icon + label (product page). */
  labelled?: boolean;
}

export function WishlistButton({ item, className, labelled = false }: Props) {
  const saved = useWishlist((s) => s.hydrated && s.items.some((i) => i.productId === item.productId));
  const toggle = useWishlist((s) => s.toggle);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${item.name} from wishlist` : `Save ${item.name} to wishlist`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggle(item);
        toast(added ? "Saved to your wishlist" : "Removed from your wishlist", added ? { label: "View", href: "/wishlist" } : undefined);
      }}
      className={cn("inline-flex items-center gap-2 transition-colors", saved ? "text-oxblood" : "text-ink hover:text-oxblood", className)}
    >
      <HeartIcon filled={saved} width={18} height={18} />
      {labelled && <span className="eyebrow">{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}

export type { CropStrategy };
