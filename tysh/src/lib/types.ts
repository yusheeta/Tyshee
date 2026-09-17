import type { CategorySlug, Department } from "@/data/taxonomy";

export type { CategorySlug, Department } from "@/data/taxonomy";
export { CATEGORY_LABELS } from "@/data/taxonomy";

export type CropStrategy = "faces,entropy" | "entropy";

export interface Colourway {
  name: string;
  hex: string;
}

/**
 * A purchasable colour of a product. Every variant has its own lead photograph and a
 * stock level per size, so the storefront can switch imagery per colour and show real
 * availability without treating colours as separate products.
 */
export interface Variant extends Colourway {
  sku: string;
  image: ProductImage;
  /** Units on hand per size label. Missing or 0 means that size is sold out. */
  sizeStock: Record<string, number>;
}

export interface ProductImage {
  /** Unsplash photo id, e.g. `photo-1539109136881-3be0616acf4b` */
  id: string;
  alt: string;
  crop: CropStrategy;
}

export interface Product {
  id: string;
  slug: string;
  /** Brand label shown on every card and product page. */
  brand: string;
  name: string;
  category: CategorySlug;
  department: Department;
  /** Integer minor units of the base currency (USD cents). */
  price: number;
  compareAtPrice?: number;
  /** Colour variants; the first is the default. */
  variants: Variant[];
  sizes: string[];
  materials: string;
  origin: string;
  description: string;
  details: string[];
  care: string;
  /** Gallery: every variant's photograph first (in variant order), then shared detail shots. */
  images: ProductImage[];
  tags: string[];
  /** Hex used for the inline LQIP placeholder gradient. */
  tone: string;
  createdAt: string;
  popularity: number;
}
