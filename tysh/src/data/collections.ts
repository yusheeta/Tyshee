import { CATEGORIES, CATEGORY_LABELS, JEWELLERY_CATEGORIES, LEATHER_CATEGORIES, RTW_BY_DEPARTMENT, SHOES_BY_DEPARTMENT, type CategorySlug } from "@/data/taxonomy";
import type { CropStrategy, Product } from "@/lib/types";

export interface Collection {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  /** Optional explicit hero; otherwise the first product's lead image is used. */
  hero?: { id: string; alt: string; crop: CropStrategy };
  match: (p: Product) => boolean;
  /** Child collections shown as a sub-navigation on this page. */
  children?: string[];
  parent?: string;
  /** Show in the primary navigation. */
  nav?: boolean;
  /** Show on the homepage collection grid. */
  featured?: boolean;
}

const isCat = (c: CategorySlug) => (p: Product) => p.category === c;
const inGroup = (g: (typeof CATEGORIES)[CategorySlug]["group"]) => (p: Product) => CATEGORIES[p.category].group === g;
const dept = (d: "women" | "men") => (p: Product) => p.department === d;
const both = (...fns: ((p: Product) => boolean)[]) => (p: Product) => fns.every((f) => f(p));

const DEPT_TITLE = { women: "Women", men: "Men" } as const;

/**
 * Department-specific category collections, e.g. `women-dresses`, `men-flats`.
 * A women's page can only ever contain women's products because the predicate says so.
 */
function departmentCategory(d: "women" | "men", c: CategorySlug, parent: string): Collection {
  return {
    slug: `${d}-${c}`,
    title: CATEGORY_LABELS[c],
    eyebrow: `${DEPT_TITLE[d]} · ${CATEGORIES[c].group === "footwear" ? "Shoes" : "Ready-to-Wear"}`,
    description: DESCRIPTIONS[c] ?? `${DEPT_TITLE[d]}'s ${CATEGORY_LABELS[c].toLowerCase()}, made slowly.`,
    match: both(dept(d), isCat(c)),
    parent,
  };
}

const DESCRIPTIONS: Partial<Record<CategorySlug, string>> = {
  coats: "Coats in double-faced cashmere, melton and gabardine, cut with an unhurried silhouette.",
  jackets: "Short in the body and clean at the shoulder: shearling, suede, quilted cotton and denim.",
  tailoring: "Half-canvassed jackets with a softly rolled shoulder and a lapel that rolls, not folds.",
  knitwear: "Grade-A cashmere and extra-fine merino from the Scottish Borders.",
  dresses: "Bias cuts and clean columns in silk and wool crepe.",
  tops: "Camisoles, shells and heavyweight tees: the layer under everything, made to be worn alone.",
  blouses: "Silk twill and georgette, finished by hand at collar and cuff.",
  shirts: "Two-ply poplin, washed linen and silk twill with mother-of-pearl buttons.",
  skirts: "Pleated, pencil, bias-cut and wrapped, from the natural waist down.",
  trousers: "High rises, full legs, hems that fall straight to the shoe.",
  jeans: "Japanese selvedge, cut like a trouser, finished without a single distress mark.",
  sarees: "Six yards of handwoven silk, linen and organza, each with an unstitched blouse piece.",
  heels: "Slingbacks, kitten heels and court shoes on a last we spent two years refining.",
  flats: "Loafers, pointed flats and derbies, Blake-stitched or Goodyear-welted.",
  ballerinas: "Soft-soled and unlined, so the leather moulds to the foot.",
  sandals: "Two straps and a leather sole. Nothing that does not need to be there.",
  boots: "Ankle, knee and Chelsea boots, welted to be resoled for as long as you own them.",
  "boat-shoes": "Hand-sewn moccasin construction on a siped rubber sole.",
  bags: "Totes, shoulder bags and holdalls, hand-cut and saddle-stitched by a single artisan.",
  "small-leather-goods": "Wallets, card holders and passport covers in full-grain calf.",
  belts: "Bridle and vegetable-tanned leather with solid brass buckles.",
  necklaces: "Pearl, collar and layered chain necklaces in recycled 18k gold and silver.",
  earrings: "Hoops, drops and pearl studs, hand-polished in Valenza.",
  rings: "Signets, stacking and band rings, cast rather than stamped.",
  bracelets: "Cuffs and link bracelets, hand-formed and hallmarked.",
  bangles: "Slim and twisted bangles, worn alone or stacked.",
  anklets: "Fine chain anklets in gold vermeil.",
  pendants: "Discs and lockets on a fine 45cm chain, engraved by hand on request.",
  chains: "Curb chains with every link soldered by hand.",
  brooches: "Sculptural brooches for a lapel, a knit or the band of a hat.",
  "jewellery-sets": "Necklaces and earrings matched by hand for lustre and size.",
  watches: "Thin cases, clean dials and leather straps that age well.",
  eyewear: "Block-cut bio-acetate and titanium, tumbled for three days and polished by hand.",
};

const womenChildren = [...RTW_BY_DEPARTMENT.women.map((c) => `women-${c}`), "women-shoes"];
const menChildren = [...RTW_BY_DEPARTMENT.men.map((c) => `men-${c}`), "men-shoes"];

export const COLLECTIONS: Collection[] = [
  {
    slug: "women",
    title: "Women",
    eyebrow: "Ready-to-Wear & Shoes",
    description: "Dresses, tailoring, knitwear, shoes and sarees cut with intention and made slowly in Italy, Scotland, Portugal and India.",
    match: dept("women"),
    children: womenChildren,
    nav: true,
    featured: true,
  },
  ...RTW_BY_DEPARTMENT.women.map((c) => departmentCategory("women", c, "women")),
  {
    slug: "women-shoes",
    title: "Women's Shoes",
    eyebrow: "Women · Shoes",
    description: "Heels, flats, ballerinas, sandals and boots, made in Marche on lasts we spent two years refining.",
    match: both(dept("women"), inGroup("footwear")),
    children: SHOES_BY_DEPARTMENT.women.map((c) => `women-${c}`),
    parent: "women",
  },
  ...SHOES_BY_DEPARTMENT.women.map((c) => departmentCategory("women", c, "women-shoes")),
  {
    slug: "men",
    title: "Men",
    eyebrow: "Ready-to-Wear & Shoes",
    description: "Soft tailoring, heavyweight knits, outerwear built for weather, and shoes welted to last.",
    match: dept("men"),
    children: menChildren,
    nav: true,
    featured: true,
  },
  ...RTW_BY_DEPARTMENT.men.map((c) => departmentCategory("men", c, "men")),
  {
    slug: "men-shoes",
    title: "Men's Shoes",
    eyebrow: "Men · Shoes",
    description: "Loafers, derbies and boat shoes, Goodyear-welted or hand-sewn.",
    match: both(dept("men"), inGroup("footwear")),
    children: SHOES_BY_DEPARTMENT.men.map((c) => `men-${c}`),
    parent: "men",
  },
  ...SHOES_BY_DEPARTMENT.men.map((c) => departmentCategory("men", c, "men-shoes")),
  {
    slug: "shoes",
    title: "Shoes",
    eyebrow: "Made in Marche",
    description: "Blake-stitched and Goodyear-welted shoes for women and men.",
    match: inGroup("footwear"),
    children: ["women-shoes", "men-shoes"],
    nav: true,
    featured: true,
  },
  {
    slug: "leather-goods",
    title: "Leather Goods",
    eyebrow: "Atelier",
    description: "Hand-cut, saddle-stitched and edge-painted by a single artisan in Tuscany.",
    match: inGroup("leather-goods"),
    children: LEATHER_CATEGORIES,
    nav: true,
    featured: true,
  },
  ...LEATHER_CATEGORIES.map<Collection>((c) => ({ slug: c, title: CATEGORY_LABELS[c], eyebrow: "Leather Goods", description: DESCRIPTIONS[c] ?? "", match: isCat(c), parent: "leather-goods" })),
  {
    slug: "jewellery",
    title: "Jewellery",
    eyebrow: "Valenza",
    description: "Recycled 18k gold, sterling silver and freshwater pearl, finished by hand and made to be worn every day.",
    match: inGroup("jewellery"),
    children: JEWELLERY_CATEGORIES,
    nav: true,
    featured: true,
  },
  ...JEWELLERY_CATEGORIES.map<Collection>((c) => ({ slug: c, title: CATEGORY_LABELS[c], eyebrow: "Jewellery", description: DESCRIPTIONS[c] ?? "", match: isCat(c), parent: "jewellery" })),
  {
    slug: "accessories",
    title: "Watches & Eyewear",
    eyebrow: "Accessories",
    description: "Swiss-made watches and hand-polished acetate.",
    match: inGroup("accessories"),
    children: ["watches", "eyewear"],
  },
  { slug: "watches", title: "Watches", eyebrow: "Accessories", description: DESCRIPTIONS.watches ?? "", match: isCat("watches"), parent: "accessories" },
  { slug: "eyewear", title: "Eyewear", eyebrow: "Accessories", description: DESCRIPTIONS.eyewear ?? "", match: isCat("eyewear"), parent: "accessories" },
  {
    slug: "fragrance-and-objects",
    title: "Fragrance & Objects",
    eyebrow: "For the home and the skin",
    description: "Composed in Grasse. Poured, woven and finished by the same hands as everything else.",
    match: inGroup("home"),
    featured: true,
  },
  {
    slug: "new-arrivals",
    title: "New Arrivals",
    eyebrow: "Autumn 2026",
    description: "The newest pieces from the atelier.",
    match: (p) => p.tags.includes("new"),
    nav: true,
  },
  {
    slug: "icons",
    title: "The Icons",
    eyebrow: "Permanent collection",
    description: "Pieces we make every season, refined rather than replaced.",
    match: (p) => p.tags.includes("icon"),
  },
  {
    slug: "all",
    title: "All Pieces",
    eyebrow: "The full collection",
    description: "Every piece currently in the atelier.",
    hero: { id: "photo-1445205170230-053b83016050", alt: "Garments on a rail", crop: "entropy" },
    match: () => true,
  },
];

const BY_SLUG = new Map(COLLECTIONS.map((c) => [c.slug, c]));

export const NAV_COLLECTIONS = COLLECTIONS.filter((c) => c.nav);
export const FEATURED_COLLECTIONS = COLLECTIONS.filter((c) => c.featured);

export function getCollection(slug: string): Collection | undefined {
  return BY_SLUG.get(slug);
}

/** The collection a product should be filed under: department-specific for gendered products. */
export function collectionForProduct(p: Pick<Product, "category" | "department">): string {
  if (p.department === "women" || p.department === "men") return `${p.department}-${p.category}`;
  return p.category;
}

/** Breadcrumb trail (root → leaf) for a collection. */
export function collectionTrail(slug: string): Collection[] {
  const trail: Collection[] = [];
  let cur = BY_SLUG.get(slug);
  let guard = 0;
  while (cur && guard++ < 6) {
    trail.unshift(cur);
    cur = cur.parent ? BY_SLUG.get(cur.parent) : undefined;
  }
  return trail;
}
