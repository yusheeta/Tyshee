"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ProductImage } from "@/components/image/ProductImage";
import { PlusIcon } from "@/components/ui/Icons";
import { Price } from "@/components/ui/Price";
import { discountPercent, inStockSizes, variantStock, type CardProduct } from "@/lib/card-product";
import { useCart } from "@/lib/cart-store";
import { SIZES, WIDTHS } from "@/lib/images";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/utils";
import { WishlistButton } from "./WishlistButton";

interface Props {
  product: CardProduct;
  sizes?: string;
  widths?: readonly number[];
  preload?: boolean;
  className?: string;
  badge?: ReactNode;
  headingLevel?: "h2" | "h3";
}

const DOUBLE_CLICK_MS = 300;

/**
 * Interactive listing card.
 *  - Double-click (or double-tap) the photograph to cycle through the colours this piece
 *    actually comes in; tapping a swatch jumps straight to that colour. The photograph,
 *    colour name and availability follow the selected variant.
 *  - A single click still opens the product page (deferred just long enough to tell it
 *    apart from a double-click).
 *  - Quick add reveals the sizes in stock for the selected colour and adds that exact
 *    variant to the bag. Wishlist saves the piece in its selected colour.
 */
export function ProductCard({ product, sizes = SIZES.gridTwoToFour, widths = WIDTHS.grid, preload = false, className, badge, headingLevel: Heading = "h3" }: Props) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [idx, setIdx] = useState(0);
  const [quickAdd, setQuickAdd] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);
  const clickTimer = useRef<number | null>(null);
  const lastClick = useRef(0);
  const href = `/products/${product.slug}`;

  const variant = product.variants[idx] ?? product.variants[0];
  const stock = variantStock(variant);
  const soldOut = stock === 0;
  const available = inStockSizes(variant, product.sizes);
  const discount = discountPercent(product.price, product.compareAtPrice);
  const multi = product.variants.length > 1;

  useEffect(() => () => {
    if (clickTimer.current) window.clearTimeout(clickTimer.current);
  }, []);

  const selectVariant = (next: number) => {
    setIdx(next);
    setFadeKey((k) => k + 1);
  };
  const cycle = () => multi && selectVariant((idx + 1) % product.variants.length);

  // Two clicks (or taps) within DOUBLE_CLICK_MS cycle the colour; a lone click opens the
  // piece once the window has passed. Detecting the pair ourselves, rather than relying on
  // the browser's dblclick event, makes double-tap work on touch screens too.
  const onImageClick = () => {
    const now = Date.now();
    if (now - lastClick.current < DOUBLE_CLICK_MS) {
      lastClick.current = 0;
      if (clickTimer.current) {
        window.clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      cycle();
      return;
    }
    lastClick.current = now;
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      router.push(href);
    }, DOUBLE_CLICK_MS);
  };

  const addSize = (size: string) => {
    add({ productId: product.id, slug: product.slug, name: product.name, price: product.price, colour: variant.name, size, image: variant.image, tone: product.tone });
    setQuickAdd(false);
    toast(`Added ${product.name} · ${variant.name} · ${size}`, { label: "View bag", href: "/cart" });
  };

  return (
    <article className={cn("group relative", className)} data-variant={variant.name}>
      <div className="relative overflow-hidden">
        {/* Photograph: click opens the piece, double-click cycles colours. */}
        <div
          role="link"
          tabIndex={0}
          aria-label={`${product.name} in ${variant.name}. Open product page. Double-click to view the next colour.`}
          onClick={onImageClick}
          onKeyDown={(e) => {
            if (e.key === "Enter") router.push(href);
            if (e.key === "ArrowRight" && multi) cycle();
          }}
          className="block cursor-pointer select-none [touch-action:manipulation]"
        >
          <div key={fadeKey} className="animate-[fade-in_420ms_var(--ease-luxe)]">
            <ProductImage image={variant.image} tone={product.tone} sizes={sizes} widths={[...widths]} preload={preload} imgClassName="transition-transform duration-[1200ms] ease-[var(--ease-luxe)] group-hover:scale-[1.02] motion-reduce:transform-none" />
          </div>
        </div>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          {discount && <span className="eyebrow bg-oxblood px-2 py-1 !text-white">−{discount}%</span>}
          {product.tags.includes("new") && <span className="eyebrow bg-paper/90 px-2 py-1 text-ink">New</span>}
          {product.tags.includes("limited") && <span className="eyebrow bg-ink px-2 py-1 text-paper">Limited</span>}
          {soldOut && <span className="eyebrow bg-paper/90 px-2 py-1 text-stone">Sold out</span>}
        </div>
        <WishlistButton
          item={{ productId: product.id, slug: product.slug, brand: product.brand, name: product.name, price: product.price, compareAtPrice: product.compareAtPrice, colour: variant.name, hex: variant.hex, image: variant.image, tone: product.tone }}
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-paper/85 backdrop-blur"
        />
        {badge && <div className="pointer-events-none absolute bottom-3 left-3">{badge}</div>}

        {multi && (
          <p className="eyebrow pointer-events-none absolute inset-x-0 bottom-3 hidden text-center !text-[0.6rem] text-white opacity-0 transition-opacity duration-300 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] md:block md:group-hover:opacity-100" aria-hidden="true">
            Double-click to view colours
          </p>
        )}

        {/* Quick add */}
        {!soldOut && (
          <div className={cn("absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-300 ease-[var(--ease-luxe)] group-focus-within:translate-y-0 md:group-hover:translate-y-0", quickAdd && "translate-y-0")}>
            {quickAdd || available.length === 1 ? (
              <div className="flex flex-wrap items-center gap-1 bg-paper/95 p-2 backdrop-blur">
                <span className="eyebrow mr-1 hidden pl-1 sm:inline">Size</span>
                {available.map((s) => (
                  <button key={s} type="button" onClick={() => addSize(s)} className="h-8 min-w-8 border border-line px-2 text-xs text-ink transition hover:border-ink hover:bg-ink hover:text-paper">
                    {s === "One Size" ? "Add to bag" : s}
                  </button>
                ))}
                {product.sizes.some((s) => !available.includes(s)) && <span className="ml-auto pr-1 text-[0.65rem] text-stone">Some sizes sold out</span>}
              </div>
            ) : (
              <button type="button" onClick={() => setQuickAdd(true)} className="eyebrow flex h-10 w-full items-center justify-center gap-2 bg-paper/95 text-ink backdrop-blur transition hover:bg-ink hover:text-paper">
                <PlusIcon width={14} height={14} /> Quick add
              </button>
            )}
          </div>
        )}
        {/* Touch devices have no hover: a small "+" opens quick add. */}
        {!soldOut && !quickAdd && (
          <button type="button" onClick={() => setQuickAdd(true)} aria-label="Quick add to bag" className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-paper/85 text-ink backdrop-blur md:hidden">
            <PlusIcon width={16} height={16} />
          </button>
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow !text-[0.6rem] text-ink">{product.brand}</p>
          <Heading className="font-serif mt-0.5 text-[1.0625rem] leading-snug text-ink">
            <Link href={href} className="hover:underline hover:underline-offset-4">
              {product.name}
            </Link>
          </Heading>
          <p className="mt-1 text-xs text-stone" aria-live="polite">
            <span className="text-graphite">{variant.name}</span>
            {multi && <span> · {product.variants.length} colours</span>}
            {!soldOut && stock <= 3 && <span className="text-oxblood"> · Only {stock} left</span>}
          </p>
        </div>
        <Price amount={product.price} compareAt={product.compareAtPrice} className="shrink-0 pt-0.5" />
      </div>

      {/* Swatches: the touch-friendly way to switch colour; also the visible hint that colours exist. */}
      <div className="mt-1.5 -ml-1 flex items-center gap-1" role="radiogroup" aria-label={`${product.name} colours`}>
        {product.variants.map((v, i) => (
          <button
            key={v.sku}
            type="button"
            role="radio"
            aria-checked={i === idx}
            aria-label={v.name}
            title={v.name}
            onClick={() => selectVariant(i)}
            // 24px hit area around a 14px dot: comfortable to tap, still discreet.
            className="flex h-6 w-6 items-center justify-center"
          >
            <span className={cn("block h-3.5 w-3.5 rounded-full ring-1 ring-offset-2 ring-offset-paper transition", i === idx ? "ring-ink" : "ring-ink/15 group-hover:ring-stone")} style={{ backgroundColor: v.hex }} />
          </button>
        ))}
        {available.length > 0 && available.length < product.sizes.length && product.sizes.length > 1 && (
          <span className="ml-auto text-[0.65rem] text-stone">{available.join(" · ")}</span>
        )}
      </div>
    </article>
  );
}
