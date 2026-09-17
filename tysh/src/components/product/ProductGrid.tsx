import type { ReactNode } from "react";
import { ProductCard } from "./ProductCard";
import { toCardProduct } from "@/lib/card-product";
import { SIZES, WIDTHS } from "@/lib/images";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  products: Product[];
  columns?: 3 | 4;
  /** Number of leading cards treated as above-the-fold (eager + preload). */
  eager?: number;
  className?: string;
  renderBadge?: (p: Product) => ReactNode;
  headingLevel?: "h2" | "h3";
}

export function ProductGrid({ products, columns = 4, eager = 0, className, renderBadge, headingLevel }: Props) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:gap-y-14",
        columns === 4 ? "md:grid-cols-3 xl:grid-cols-4" : "lg:grid-cols-3",
        className,
      )}
    >
      {products.map((p, i) => (
        <ProductCard
          key={p.id}
          product={toCardProduct(p)}
          preload={i < eager}
          sizes={columns === 4 ? SIZES.gridTwoToFour : SIZES.gridTwoToThree}
          widths={WIDTHS.grid}
          badge={renderBadge?.(p)}
          headingLevel={headingLevel}
        />
      ))}
    </div>
  );
}
