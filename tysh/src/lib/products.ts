import "server-only";
import raw from "@/data/products.json";
import { COLLECTIONS, getCollection } from "@/data/collections";
import type { CategorySlug, Department, Product } from "@/lib/types";

const PRODUCTS = raw as Product[];
const BY_SLUG = new Map(PRODUCTS.map((p) => [p.slug, p]));
const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export type SortKey = "featured" | "newest" | "price-asc" | "price-desc";

export interface Filters {
  department?: Department;
  category?: CategorySlug;
  colour?: string; // colourway name (case-insensitive)
  size?: string;
  maxPrice?: number;
  q?: string;
}

export function getAllProducts(): Product[] {
  return PRODUCTS;
}

export function getProductBySlug(slug: string): Product | undefined {
  return BY_SLUG.get(slug);
}

export function getProductById(id: string): Product | undefined {
  return BY_ID.get(id);
}

export function getCollectionProducts(slug: string): Product[] {
  const c = getCollection(slug);
  return c ? PRODUCTS.filter(c.match) : [];
}

export function applyFilters(products: Product[], f: Filters): Product[] {
  let out = products;
  if (f.department) out = out.filter((p) => p.department === f.department);
  if (f.category) out = out.filter((p) => p.category === f.category);
  if (f.colour) {
    const c = f.colour.toLowerCase();
    out = out.filter((p) => p.variants.some((v) => v.name.toLowerCase() === c));
  }
  if (f.size) out = out.filter((p) => p.sizes.includes(f.size!));
  if (f.maxPrice) out = out.filter((p) => p.price <= f.maxPrice!);
  if (f.q) out = searchProducts(f.q, out);
  return out;
}

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const out = [...products];
  switch (sort) {
    case "newest":
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.popularity - a.popularity);
    case "price-asc":
      return out.sort((a, b) => a.price - b.price);
    case "price-desc":
      return out.sort((a, b) => b.price - a.price);
    default:
      return out.sort(
        (a, b) =>
          Number(b.tags.includes("icon")) - Number(a.tags.includes("icon")) ||
          b.popularity - a.popularity,
      );
  }
}

export function searchProducts(query: string, within: Product[] = PRODUCTS): Product[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return within;
  return within
    .map((p) => {
      const hay = [p.name, p.category, p.department, p.materials, ...p.variants.map((v) => v.name), ...p.tags]
        .join(" ")
        .toLowerCase();
      const score = terms.reduce((s, t) => (hay.includes(t) ? s + (p.name.toLowerCase().includes(t) ? 3 : 1) : s), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.popularity - a.p.popularity)
    .map((x) => x.p);
}

/**
 * Related pieces never cross departments: a women's dress suggests other women's pieces,
 * first from the same category, then from the same department.
 */
export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const sameDept = (p: Product) => p.id !== product.id && p.department === product.department;
  const same = PRODUCTS.filter((p) => sameDept(p) && p.category === product.category);
  const rest = sortProducts(PRODUCTS.filter((p) => sameDept(p) && p.category !== product.category), "featured");
  return [...same, ...rest].slice(0, limit);
}

/** Hero image for a collection: explicit if set, otherwise its most featured product's lead photograph. */
export function getCollectionHero(slug: string): { id: string; alt: string; crop: Product["images"][number]["crop"]; tone: string } | null {
  const c = getCollection(slug);
  if (!c) return null;
  if (c.hero) return { ...c.hero, tone: "#D8D1C4" };
  const [first] = sortProducts(PRODUCTS.filter(c.match), "featured");
  return first ? { ...first.images[0], tone: first.tone } : null;
}

export function getFeaturedProducts(limit = 8): Product[] {
  return sortProducts(PRODUCTS.filter((p) => p.tags.includes("editorial") || p.tags.includes("icon")), "featured").slice(0, limit);
}

export function getNewArrivals(limit = 8): Product[] {
  return sortProducts(PRODUCTS.filter((p) => p.tags.includes("new")), "newest").slice(0, limit);
}

export interface Facets {
  colours: { name: string; hex: string; count: number }[];
  sizes: string[];
  categories: { slug: CategorySlug; count: number }[];
  departments: Department[];
  priceMax: number;
}

export function getFacets(products: Product[]): Facets {
  const colours = new Map<string, { name: string; hex: string; count: number }>();
  const sizes = new Set<string>();
  const categories = new Map<CategorySlug, number>();
  const departments = new Set<Department>();
  let priceMax = 0;
  for (const p of products) {
    for (const c of p.variants) {
      const e = colours.get(c.name) ?? { name: c.name, hex: c.hex, count: 0 };
      e.count++;
      colours.set(c.name, e);
    }
    p.sizes.forEach((s) => sizes.add(s));
    categories.set(p.category, (categories.get(p.category) ?? 0) + 1);
    departments.add(p.department);
    priceMax = Math.max(priceMax, p.price);
  }
  const sizeOrder = ["XS", "S", "M", "L", "XL"];
  return {
    colours: [...colours.values()].sort((a, b) => b.count - a.count),
    sizes: [...sizes].sort((a, b) => {
      const ai = sizeOrder.indexOf(a);
      const bi = sizeOrder.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.localeCompare(b, undefined, { numeric: true });
    }),
    categories: [...categories.entries()].map(([slug, count]) => ({ slug, count })).sort((a, b) => b.count - a.count),
    departments: [...departments],
    priceMax,
  };
}

export function allCollectionSlugs(): string[] {
  return COLLECTIONS.map((c) => c.slug);
}

/** Units available across all sizes of a variant. */
export function variantStock(v: Product["variants"][number]): number {
  return Object.values(v.sizeStock).reduce((s, n) => s + n, 0);
}
