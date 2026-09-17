import type { Metadata } from "next";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Container } from "@/components/ui/Container";
import { SearchIcon } from "@/components/ui/Icons";
import { searchProducts } from "@/lib/products";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const results = query ? searchProducts(query) : [];
  const suggestions = ["cashmere", "camel coat", "loafer", "silk", "gold", "oxblood", "navy blazer", "tote"];

  return (
    <Container className="pt-14 lg:pt-20">
      <p className="eyebrow">Search</p>
      <form action="/search" method="get" role="search" className="mt-4 flex max-w-2xl items-end gap-4">
        <label htmlFor="q" className="sr-only">
          Search the collection
        </label>
        <input id="q" name="q" type="search" defaultValue={query} placeholder="Search pieces, materials, colours" autoFocus className="field !text-2xl !font-serif sm:!text-4xl" />
        <button type="submit" className="flex h-12 w-12 shrink-0 items-center justify-center border border-ink transition hover:bg-ink hover:text-paper" aria-label="Search">
          <SearchIcon />
        </button>
      </form>

      {!query && (
        <div className="mt-10 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <a key={s} href={`/search?q=${encodeURIComponent(s)}`} className="border border-line px-3 py-2 text-xs text-graphite transition hover:border-ink">
              {s}
            </a>
          ))}
        </div>
      )}

      {query && (
        <>
          <p className="mt-8 text-xs text-stone">
            {results.length} {results.length === 1 ? "result" : "results"} for <span className="text-ink">“{query}”</span>
          </p>
          {results.length ? (
            <ProductGrid products={results} eager={2} className="mt-8" headingLevel="h2" />
          ) : (
            <p className="mt-16 font-serif text-2xl">Nothing found. Try a material, a colour or a category.</p>
          )}
        </>
      )}
    </Container>
  );
}
