"use client";

import Link from "next/link";
import { ProductImage } from "@/components/image/ProductImage";
import { MinusIcon, PlusIcon } from "@/components/ui/Icons";
import { cartTotals, FREE_SHIPPING_THRESHOLD, useCart } from "@/lib/cart-store";
import { useMoney } from "@/lib/currency-store";
import { SIZES, WIDTHS } from "@/lib/images";

export function CartView() {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const { subtotal, shipping, total, count } = cartTotals(items);
  const { format } = useMoney();

  if (!hydrated) {
    return <div className="mt-12 h-40 animate-pulse bg-bone" aria-busy="true" />;
  }

  if (!items.length) {
    return (
      <div className="mt-16 max-w-md">
        <p className="font-serif text-2xl">Your bag is empty.</p>
        <p className="mt-3 text-sm leading-relaxed text-stone">Pieces you add will wait here, on this device, until you are ready.</p>
        <Link href="/collections/new-arrivals" className="btn mt-8">
          Discover new arrivals
        </Link>
      </div>
    );
  }

  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;

  return (
    <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-16">
      <ul className="divide-y divide-line lg:col-span-7">
        {items.map((i) => (
          <li key={i.key} className="flex gap-5 py-7 sm:gap-8">
            <Link href={`/products/${i.slug}`} className="w-24 shrink-0 sm:w-32">
              <ProductImage image={i.image} tone={i.tone} sizes={SIZES.cartThumb} widths={[...WIDTHS.cartThumb]} quality={65} />
            </Link>
            <div className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/products/${i.slug}`} className="font-serif text-lg leading-snug">
                    {i.name}
                  </Link>
                  <p className="mt-1 text-xs text-stone">
                    {i.colour} · Size {i.size}
                  </p>
                </div>
                <p className="text-sm tabular-nums">{format(i.price * i.qty)}</p>
              </div>
              <div className="mt-auto flex items-center justify-between pt-4">
                <div className="inline-flex items-center border border-line">
                  <button type="button" className="flex h-9 w-9 items-center justify-center hover:bg-bone" onClick={() => setQty(i.key, i.qty - 1)} aria-label={`Decrease quantity of ${i.name}`}>
                    <MinusIcon width={14} height={14} />
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
                    {i.qty}
                  </span>
                  <button type="button" className="flex h-9 w-9 items-center justify-center hover:bg-bone" onClick={() => setQty(i.key, i.qty + 1)} aria-label={`Increase quantity of ${i.name}`}>
                    <PlusIcon width={14} height={14} />
                  </button>
                </div>
                <button type="button" onClick={() => remove(i.key)} className="link-underline text-xs text-stone">
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="lg:col-span-5">
        <div className="border border-line p-6 sm:p-8 lg:sticky lg:top-28">
          <p className="eyebrow">Summary</p>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone">
                Subtotal · {count} {count === 1 ? "item" : "items"}
              </dt>
              <dd className="tabular-nums">{format(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone">Shipping</dt>
              <dd className="tabular-nums">{shipping === 0 ? "Complimentary" : format(shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-4 text-base">
              <dt>Total</dt>
              <dd className="tabular-nums">{format(total)}</dd>
            </div>
          </dl>
          {remaining > 0 && <p className="mt-4 text-xs text-stone">Add {format(remaining)} more for free shipping.</p>}
          <Link href="/checkout" className="btn mt-8 w-full">
            Proceed to checkout
          </Link>
          <p className="mt-4 text-center text-xs text-stone">Duties and taxes included. Secure checkout.</p>
        </div>
      </aside>
    </div>
  );
}
