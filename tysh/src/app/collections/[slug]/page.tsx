import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MatchBadge } from "@/components/colour/MatchBadge";
import { PaletteToggle } from "@/components/colour/PaletteToggle";
import { ArtDirectedImage } from "@/components/image/ArtDirectedImage";
import { FilterChips, hrefWith, type PlpParams } from "@/components/product/FilterChips";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SortSelect } from "@/components/product/SortSelect";
import { Container } from "@/components/ui/Container";
import { COLLECTIONS, collectionTrail, getCollection } from "@/data/collections";
import { bestMatch } from "@/lib/colour/match";
import { getSeason } from "@/lib/colour/seasons";
import { applyFilters, getCollectionHero, getCollectionProducts, getFacets, sortProducts, type SortKey } from "@/lib/products";
import type { CategorySlug, Department, Product } from "@/lib/types";

const PAGE_SIZE = 24;

type Params = { slug: string };
type Search = Record<string, string | string[] | undefined>;

export function generateStaticParams(): Params[] {
  return COLLECTIONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getCollection(slug);
  if (!c) return {};
  const trail = collectionTrail(c.slug);
  const title = trail.length > 1 ? `${trail[0].title} · ${c.title}` : c.title;
  return { title, description: c.description, alternates: { canonical: `/collections/${c.slug}` } };
}

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v || undefined;
}

export default async function CollectionPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const collection = getCollection(slug);
  if (!collection) notFound();

  const p: PlpParams = {
    sort: str(sp.sort),
    colour: str(sp.colour),
    size: str(sp.size),
    department: str(sp.department),
    category: str(sp.category),
    season: str(sp.season),
    page: str(sp.page),
  };
  const base = `/collections/${collection.slug}`;
  const all = getCollectionProducts(collection.slug);
  const facets = getFacets(all);

  let products = applyFilters(all, {
    department: p.department as Department | undefined,
    category: p.category as CategorySlug | undefined,
    colour: p.colour,
    size: p.size,
  });
  const sort = (["featured", "newest", "price-asc", "price-desc"].includes(p.sort ?? "") ? p.sort : "featured") as SortKey;
  products = sortProducts(products, sort);

  const season = getSeason(p.season);
  const matches = new Map<string, ReturnType<typeof bestMatch<Product["variants"][number]>>>();
  if (season) {
    for (const prod of products) matches.set(prod.id, bestMatch(prod.variants, season));
    products = [...products].sort((a, b) => (matches.get(b.id)?.result.score ?? 0) - (matches.get(a.id)?.result.score ?? 0));
  }

  const page = Math.max(1, parseInt(p.page ?? "1", 10) || 1);
  const pageCount = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const pageItems = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isCategoryCollection = all.every((x) => x.category === all[0]?.category);
  const isDepartmentCollection = all.every((x) => x.department === all[0]?.department);
  const active = [p.department, p.category, p.colour, p.size].filter(Boolean).length;
  const children = (collection.children ?? []).map((slug) => getCollection(slug)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const trail = collectionTrail(collection.slug).slice(0, -1);
  const hero = collection.featured || (collection.children && !collection.parent) ? getCollectionHero(collection.slug) : null;

  return (
    <>
      {hero ? (
        <section className="relative h-[36svh] min-h-[240px] max-h-[440px] overflow-hidden bg-bone">
          <ArtDirectedImage id={hero.id} alt={hero.alt} crop={hero.crop} tone={hero.tone} mobileAr="4:3" desktopAr="21:9" quality={60} imgClassName="object-[50%_30%]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0">
            <Container className="pb-8 text-white lg:pb-12">
              <p className="eyebrow !text-white/80">{collection.eyebrow}</p>
              <h1 className="display mt-3 text-5xl sm:text-6xl lg:text-7xl">{collection.title}</h1>
            </Container>
          </div>
        </section>
      ) : (
        <Container className="pt-14 lg:pt-20">
          {trail.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-xs text-stone">
              <Link href="/" className="link-underline">Home</Link>
              {trail.map((c) => (
                <span key={c.slug} className="contents">
                  <span aria-hidden="true">/</span>
                  <Link href={`/collections/${c.slug}`} className="link-underline">{c.title}</Link>
                </span>
              ))}
            </nav>
          )}
          <p className="eyebrow">{collection.eyebrow}</p>
          <h1 className="display mt-3 text-5xl sm:text-6xl lg:text-7xl">{collection.title}</h1>
        </Container>
      )}

      <Container className="mt-8 lg:mt-10">
        <p className="measure text-[15px] leading-relaxed text-graphite">{collection.description}</p>

        {children.length > 0 && (
          <nav aria-label={`${collection.title} categories`} className="mt-8 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ul className="flex gap-2 sm:flex-wrap">
              {children.map((c) => (
                <li key={c.slug} className="shrink-0">
                  <Link href={`/collections/${c.slug}`} className="inline-flex h-9 items-center border border-line px-3 text-xs text-graphite transition hover:border-ink hover:text-ink">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="mt-10 flex flex-col gap-6 border-y border-line py-5 lg:flex-row lg:items-start lg:justify-between">
          <FilterChips base={base} params={p} facets={facets} showDepartments={!isDepartmentCollection && children.length === 0} showCategories={!isCategoryCollection && children.length === 0} />
          <div className="flex shrink-0 flex-wrap items-center gap-5">
            <Suspense fallback={<span className="inline-block h-9 w-40" />}>
              <PaletteToggle />
            </Suspense>
            <Suspense fallback={null}>
              <SortSelect />
            </Suspense>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-stone">
          <p>
            {products.length} {products.length === 1 ? "piece" : "pieces"}
            {season && <> · sorted for <span className="text-ink">{season.label}</span></>}
          </p>
          {active > 0 && (
            <Link href={hrefWith(base, { sort: p.sort, season: p.season }, {})} className="link-underline text-ink">
              Clear filters
            </Link>
          )}
        </div>

        {pageItems.length ? (
          <ProductGrid
            products={pageItems}
            eager={page === 1 ? 2 : 0}
            className="mt-8"
            headingLevel="h2"
            renderBadge={
              season
                ? (prod) => {
                    const m = matches.get(prod.id);
                    return m && m.result.rating !== "not-your-best" ? <MatchBadge rating={m.result.rating} label={m.result.label} /> : null;
                  }
                : undefined
            }
          />
        ) : (
          <div className="py-24 text-center">
            <p className="font-serif text-2xl">Nothing matches those filters.</p>
            <Link href={base} className="btn btn-ghost mt-6">
              Clear filters
            </Link>
          </div>
        )}

        {pageCount > 1 && (
          <nav className="mt-16 flex items-center justify-center gap-6 text-sm" aria-label="Pagination">
            {page > 1 ? (
              <Link href={`${hrefWith(base, p, {})}${hrefWith(base, p, {}).includes("?") ? "&" : "?"}page=${page - 1}`} className="link-underline">
                Previous
              </Link>
            ) : (
              <span className="text-stone">Previous</span>
            )}
            <span className="text-stone">
              {page} / {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={`${hrefWith(base, p, {})}${hrefWith(base, p, {}).includes("?") ? "&" : "?"}page=${page + 1}`} className="link-underline">
                Next
              </Link>
            ) : (
              <span className="text-stone">Next</span>
            )}
          </nav>
        )}
      </Container>
    </>
  );
}
