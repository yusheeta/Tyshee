"use client";

import Link from "next/link";
import { ProductImage } from "@/components/image/ProductImage";
import { Price } from "@/components/ui/Price";
import { SIZES, WIDTHS } from "@/lib/images";
import { toast } from "@/lib/toast-store";
import { useWishlist } from "@/lib/wishlist-store";

export function WishlistView() {
  const items = useWishlist((s) => s.items);
  const hydrated = useWishlist((s) => s.hydrated);
  const remove = useWishlist((s) => s.remove);

  if (!hydrated) return <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse bg-bone" />)}</div>;

  if (!items.length) {
    return (
      <div className="mt-16 max-w-md">
        <p className="font-serif text-2xl">Nothing saved yet.</p>
        <p className="mt-3 text-sm leading-relaxed text-stone">Tap the heart on any piece to keep it here, in the colour you chose.</p>
        <Link href="/collections/new-arrivals" className="btn mt-8">Discover new arrivals</Link>
      </div>
    );
  }

  return (
    <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4 lg:gap-x-6">
      {items.map((i) => (
        <li key={i.productId} className="group">
          <Link href={`/products/${i.slug}`} className="block">
            <ProductImage image={i.image} tone={i.tone} sizes={SIZES.gridTwoToFour} widths={[...WIDTHS.grid]} imgClassName="transition-transform duration-[1200ms] ease-[var(--ease-luxe)] group-hover:scale-[1.02] motion-reduce:transform-none" />
          </Link>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow !text-[0.6rem] text-ink">{i.brand}</p>
              <Link href={`/products/${i.slug}`} className="font-serif mt-0.5 block text-[1.0625rem] leading-snug text-ink">{i.name}</Link>
              <p className="mt-1 flex items-center gap-2 text-xs text-stone">
                <span className="h-3 w-3 rounded-full ring-1 ring-ink/15" style={{ backgroundColor: i.hex }} aria-hidden="true" />
                {i.colour}
              </p>
            </div>
            <Price amount={i.price} compareAt={i.compareAtPrice} className="shrink-0 pt-0.5" />
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <Link href={`/products/${i.slug}`} className="eyebrow link-underline text-ink">Choose size</Link>
            <button type="button" onClick={() => { remove(i.productId); toast("Removed from your wishlist"); }} className="link-underline text-stone">Remove</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
