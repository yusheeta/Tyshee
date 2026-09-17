import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";
import { toCardProduct } from "@/lib/card-product";

/** Horizontal, scroll-snapping rail. CSS only. */
export function ProductRail({ products }: { products: Product[] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex snap-x snap-mandatory gap-4 sm:gap-6">
        {products.map((p) => (
          <li key={p.id} className="w-[68vw] shrink-0 snap-start sm:w-[42vw] lg:w-[23vw] xl:w-[21vw]">
            <ProductCard product={toCardProduct(p)} sizes="(min-width: 1280px) 21vw, (min-width: 1024px) 23vw, (min-width: 640px) 42vw, 68vw" />
          </li>
        ))}
      </ul>
    </div>
  );
}
