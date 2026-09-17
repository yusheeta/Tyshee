"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { ColourMatch } from "@/components/colour/ColourMatch";
import { ProductImage } from "@/components/image/ProductImage";
import { CheckIcon, MinusIcon, PlusIcon } from "@/components/ui/Icons";
import { Price } from "@/components/ui/Price";
import { discountPercent, inStockSizes, variantStock } from "@/lib/card-product";
import { MAX_QTY, useCart } from "@/lib/cart-store";
import { SIZES, WIDTHS } from "@/lib/images";
import { toast } from "@/lib/toast-store";
import type { Product } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WishlistButton } from "./WishlistButton";

/**
 * Product page: gallery and purchase panel share one selected variant. Choosing a colour
 * (swatch, or double-clicking the main photograph) swaps the photograph, the colour name,
 * the sizes that are in stock and the availability line. Sizes that are sold out in the
 * selected colour are disabled rather than hidden, and quantity is capped by real stock.
 */
export function ProductView({ product, children }: { product: Product; children?: ReactNode }) {
  const add = useCart((s) => s.add);
  const [idx, setIdx] = useState(0);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(product.sizes.length === 1 ? product.sizes[0] : null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTap = useRef(0);

  const variant = product.variants[idx];
  const stock = variantStock(variant);
  const available = inStockSizes(variant, product.sizes);
  const sizeStock = size ? variant.sizeStock[size] ?? 0 : 0;
  const maxQty = Math.max(1, Math.min(MAX_QTY, size ? sizeStock : stock));
  const discount = discountPercent(product.price, product.compareAtPrice);
  const detailShots = product.images.filter((im) => !product.variants.some((v) => v.image.id === im.id));
  const gallery = [variant.image, ...detailShots];
  const mainImage = gallery.find((im) => im.id === activeImage) ?? variant.image;

  const selectVariant = (i: number) => {
    setIdx(i);
    setActiveImage(null);
    setQty(1);
    setError(null);
    if (size && (product.variants[i].sizeStock[size] ?? 0) === 0) setSize(product.sizes.length === 1 ? product.sizes[0] : null);
  };

  const availability = stock === 0
    ? { text: "Sold out in this colour", tone: "text-stone" }
    : size
      ? sizeStock === 0
        ? { text: `Size ${size} is sold out in ${variant.name}`, tone: "text-oxblood" }
        : sizeStock <= 3
          ? { text: `Only ${sizeStock} left in size ${size}`, tone: "text-oxblood" }
          : { text: "In stock · ships in 1–2 working days", tone: "text-graphite" }
      : stock <= 3
        ? { text: `Only ${stock} left`, tone: "text-oxblood" }
        : { text: "In stock · ships in 1–2 working days", tone: "text-graphite" };

  const onAdd = () => {
    if (!size) return setError("Please select a size.");
    if (sizeStock === 0) return setError(`Size ${size} is sold out in ${variant.name}.`);
    setError(null);
    add({ productId: product.id, slug: product.slug, name: product.name, price: product.price, colour: variant.name, size, image: variant.image, tone: product.tone }, qty);
    setAdded(true);
    toast(`Added ${product.name} · ${variant.name} · ${size} × ${qty}`, { label: "View bag", href: "/cart" });
    window.setTimeout(() => setAdded(false), 3000);
  };

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      {/* Gallery */}
      <div className="lg:col-span-7">
        <div
          onClick={() => {
            const now = Date.now();
            if (now - lastTap.current < 300 && product.variants.length > 1) {
              lastTap.current = 0;
              selectVariant((idx + 1) % product.variants.length);
            } else lastTap.current = now;
          }}
          className="relative select-none [touch-action:manipulation]"
          title={product.variants.length > 1 ? "Double-click to view the next colour" : undefined}
        >
          <div key={`${variant.sku}-${mainImage.id}`} className="animate-[fade-in_420ms_var(--ease-luxe)]">
            <ProductImage image={mainImage} tone={product.tone} sizes={SIZES.gallery} widths={[...WIDTHS.gallery]} ar="3:4" preload quality={75} />
          </div>
          {discount && <span className="eyebrow absolute left-4 top-4 bg-oxblood px-2 py-1 !text-white">−{discount}%</span>}
          {product.variants.length > 1 && (
            <p className="eyebrow pointer-events-none absolute inset-x-0 bottom-4 hidden text-center !text-[0.6rem] text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] md:block" aria-hidden="true">
              Double-click to view colours
            </p>
          )}
        </div>
        <ul className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6" aria-label="Product photographs">
          {gallery.map((im) => (
            <li key={im.id}>
              <button
                type="button"
                onClick={() => setActiveImage(im.id)}
                aria-pressed={mainImage.id === im.id}
                aria-label={im.alt}
                className={cn("block w-full ring-1 ring-offset-2 ring-offset-paper transition", mainImage.id === im.id ? "ring-ink" : "ring-transparent hover:ring-stone")}
              >
                <ProductImage image={im} tone={product.tone} sizes={SIZES.thumb} widths={[...WIDTHS.cartThumb]} quality={60} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Panel */}
      <div className="lg:col-span-5">
        <div className="lg:sticky lg:top-28">
          <p className="eyebrow text-ink">{product.brand}</p>
          <p className="eyebrow mt-1">
            {product.department !== "unisex" && <span className="capitalize">{product.department} · </span>}
            {CATEGORY_LABELS[product.category]}
          </p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">{product.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <Price amount={product.price} compareAt={product.compareAtPrice} className="!text-base" />
            {discount && <span className="text-xs text-oxblood">Save {discount}%</span>}
          </div>

          <div className="mt-8">
            <p className="text-sm">
              <span className="text-stone">Colour</span> <span className="ml-2" aria-live="polite">{variant.name}</span>
              {product.variants.length > 1 && <span className="ml-2 text-xs text-stone">· {product.variants.length} available</span>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Colour">
              {product.variants.map((v, i) => {
                const vStock = variantStock(v);
                return (
                  <button
                    key={v.sku}
                    type="button"
                    role="radio"
                    aria-checked={i === idx}
                    aria-label={`${v.name}${vStock === 0 ? ", sold out" : ""}`}
                    title={vStock === 0 ? `${v.name} · sold out` : v.name}
                    onClick={() => selectVariant(i)}
                    className={cn("relative h-8 w-8 rounded-full ring-1 ring-offset-2 ring-offset-paper transition", i === idx ? "ring-ink" : "ring-ink/15 hover:ring-stone", vStock === 0 && "opacity-50")}
                    style={{ backgroundColor: v.hex }}
                  >
                    {vStock === 0 && <span aria-hidden="true" className="absolute inset-0 m-auto h-px w-full rotate-45 bg-ink/70" />}
                  </button>
                );
              })}
            </div>
          </div>

          {product.sizes.length > 1 && (
            <div className="mt-8">
              <div className="flex items-center justify-between text-sm">
                <p>
                  <span className="text-stone">Size</span> {size && <span className="ml-2">{size}</span>}
                </p>
                <Link href="/client-services/size-guide" className="link-underline text-xs text-stone">Size guide</Link>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Size">
                {product.sizes.map((s) => {
                  const n = variant.sizeStock[s] ?? 0;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={s === size}
                      aria-label={`Size ${s}${n === 0 ? ", sold out" : n <= 3 ? `, only ${n} left` : ""}`}
                      disabled={n === 0}
                      onClick={() => {
                        setSize(s);
                        setQty(1);
                        setError(null);
                      }}
                      className={cn("relative h-11 border text-sm transition", s === size ? "border-ink bg-ink text-paper" : "border-line hover:border-ink", n === 0 && "cursor-not-allowed text-stone line-through hover:border-line")}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              {available.length < product.sizes.length && <p className="mt-2 text-xs text-stone">Struck-through sizes are sold out in {variant.name}.</p>}
            </div>
          )}

          <div className="mt-8 flex items-end gap-3">
            <div>
              <p className="eyebrow mb-2">Quantity</p>
              <div className="inline-flex h-12 items-center border border-line">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="flex h-full w-11 items-center justify-center disabled:opacity-40" aria-label="Decrease quantity">
                  <MinusIcon width={14} height={14} />
                </button>
                <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} className="flex h-full w-11 items-center justify-center disabled:opacity-40" aria-label="Increase quantity">
                  <PlusIcon width={14} height={14} />
                </button>
              </div>
            </div>
            <button type="button" onClick={onAdd} disabled={stock === 0} className="btn h-12 flex-1">
              {stock === 0 ? "Sold out" : added ? <><CheckIcon width={16} height={16} /> Added to bag</> : "Add to bag"}
            </button>
            <WishlistButton
              item={{ productId: product.id, slug: product.slug, brand: product.brand, name: product.name, price: product.price, compareAtPrice: product.compareAtPrice, colour: variant.name, hex: variant.hex, image: variant.image, tone: product.tone }}
              className="flex h-12 w-12 items-center justify-center border border-line hover:border-ink"
            />
          </div>
          <p className={cn("mt-3 text-xs", availability.tone)} aria-live="polite">{availability.text}</p>
          <p className="mt-1 min-h-4 text-xs text-oxblood" role="alert">{error}</p>

          <ul className="mt-6 space-y-1.5 text-xs text-stone">
            <li>{product.materials}. {product.origin}.</li>
            <li>Pure fibres, quality-checked twice before dispatch.</li>
            <li>Free shipping over $75. Free returns within 30 days.</li>
          </ul>

          <div className="mt-8">
            <ColourMatch hex={variant.hex} colourName={variant.name} colourways={product.variants} onPickColour={(name) => selectVariant(Math.max(0, product.variants.findIndex((v) => v.name === name)))} />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
