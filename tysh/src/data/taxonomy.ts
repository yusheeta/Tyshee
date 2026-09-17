/**
 * Catalogue taxonomy. Every product carries exactly one `category`; categories roll up
 * into a `group`, and department (women / men / unisex) is orthogonal. Collections are
 * derived from this file, so adding a category here is the only step needed to get a
 * listing page, navigation entry, breadcrumb and filter chip for it.
 */
export type Department = "women" | "men" | "unisex";

export type Group = "ready-to-wear" | "footwear" | "leather-goods" | "jewellery" | "accessories" | "home";

export const GROUP_LABELS: Record<Group, string> = {
  "ready-to-wear": "Ready-to-Wear",
  footwear: "Shoes",
  "leather-goods": "Leather Goods",
  jewellery: "Jewellery",
  accessories: "Accessories",
  home: "Fragrance & Home",
};

export const CATEGORIES = {
  // Ready-to-wear
  coats: { label: "Coats", group: "ready-to-wear" },
  jackets: { label: "Jackets", group: "ready-to-wear" },
  tailoring: { label: "Blazers & Tailoring", group: "ready-to-wear" },
  knitwear: { label: "Knitwear", group: "ready-to-wear" },
  dresses: { label: "Dresses", group: "ready-to-wear" },
  tops: { label: "Tops", group: "ready-to-wear" },
  blouses: { label: "Blouses", group: "ready-to-wear" },
  shirts: { label: "Shirts", group: "ready-to-wear" },
  skirts: { label: "Skirts", group: "ready-to-wear" },
  trousers: { label: "Trousers", group: "ready-to-wear" },
  jeans: { label: "Jeans", group: "ready-to-wear" },
  sarees: { label: "Sarees", group: "ready-to-wear" },
  // Footwear
  heels: { label: "Heels", group: "footwear" },
  flats: { label: "Flats & Loafers", group: "footwear" },
  ballerinas: { label: "Ballerinas", group: "footwear" },
  sandals: { label: "Sandals", group: "footwear" },
  boots: { label: "Boots", group: "footwear" },
  "boat-shoes": { label: "Boat Shoes", group: "footwear" },
  // Leather goods
  bags: { label: "Bags", group: "leather-goods" },
  "small-leather-goods": { label: "Wallets & Card Holders", group: "leather-goods" },
  belts: { label: "Belts", group: "leather-goods" },
  // Jewellery
  necklaces: { label: "Necklaces", group: "jewellery" },
  earrings: { label: "Earrings", group: "jewellery" },
  rings: { label: "Rings", group: "jewellery" },
  bracelets: { label: "Bracelets", group: "jewellery" },
  bangles: { label: "Bangles", group: "jewellery" },
  anklets: { label: "Anklets", group: "jewellery" },
  pendants: { label: "Pendants", group: "jewellery" },
  chains: { label: "Chains", group: "jewellery" },
  brooches: { label: "Brooches", group: "jewellery" },
  "jewellery-sets": { label: "Jewellery Sets", group: "jewellery" },
  // Accessories
  watches: { label: "Watches", group: "accessories" },
  eyewear: { label: "Eyewear", group: "accessories" },
  // Home
  fragrance: { label: "Fragrance", group: "home" },
  objects: { label: "Objects", group: "home" },
} as const satisfies Record<string, { label: string; group: Group }>;

export type CategorySlug = keyof typeof CATEGORIES;

export const CATEGORY_LABELS: Record<CategorySlug, string> = Object.fromEntries(
  Object.entries(CATEGORIES).map(([k, v]) => [k, v.label]),
) as Record<CategorySlug, string>;

export function categoryGroup(slug: CategorySlug): Group {
  return CATEGORIES[slug].group;
}

/** Ready-to-wear categories offered per department, in navigation order. */
export const RTW_BY_DEPARTMENT: Record<"women" | "men", CategorySlug[]> = {
  women: ["dresses", "tops", "blouses", "shirts", "skirts", "trousers", "jeans", "knitwear", "tailoring", "jackets", "coats", "sarees"],
  men: ["shirts", "tops", "knitwear", "tailoring", "jackets", "coats", "trousers", "jeans"],
};

/** Footwear categories offered per department, in navigation order. */
export const SHOES_BY_DEPARTMENT: Record<"women" | "men", CategorySlug[]> = {
  women: ["heels", "flats", "ballerinas", "sandals", "boots"],
  men: ["flats", "boat-shoes"],
};

export const JEWELLERY_CATEGORIES: CategorySlug[] = ["necklaces", "earrings", "rings", "bracelets", "bangles", "anklets", "pendants", "chains", "brooches", "jewellery-sets"];

export const LEATHER_CATEGORIES: CategorySlug[] = ["bags", "small-leather-goods", "belts"];

export const BRAND = "TYSHEE";
