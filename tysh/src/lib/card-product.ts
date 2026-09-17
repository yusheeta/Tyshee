import type { Product, Variant } from "@/lib/types";

/** The slice of a product a listing card needs. Keeps the client payload small. */
export type CardProduct = Pick<Product, "id" | "slug" | "brand" | "name" | "price" | "compareAtPrice" | "variants" | "sizes" | "tone" | "tags" | "category" | "department">;

export function toCardProduct(p: Product): CardProduct {
  const { id, slug, brand, name, price, compareAtPrice, variants, sizes, tone, tags, category, department } = p;
  return { id, slug, brand, name, price, compareAtPrice, variants, sizes, tone, tags, category, department };
}

export function variantStock(v: Variant): number {
  return Object.values(v.sizeStock).reduce((s, n) => s + n, 0);
}

export function inStockSizes(v: Variant, sizes: string[]): string[] {
  return sizes.filter((s) => (v.sizeStock[s] ?? 0) > 0);
}

export function discountPercent(price: number, compareAt?: number): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round((1 - price / compareAt) * 100);
}
