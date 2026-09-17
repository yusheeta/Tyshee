import { CollectionTiles } from "@/components/home/CollectionTiles";
import { ColourPromo } from "@/components/home/ColourPromo";
import { EditorialSplit } from "@/components/home/EditorialSplit";
import { Hero } from "@/components/home/Hero";
import { JournalTeaser } from "@/components/home/JournalTeaser";
import { ProductRail } from "@/components/home/ProductRail";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FEATURED_COLLECTIONS } from "@/data/collections";
import { STORIES } from "@/data/journal";
import { getFeaturedProducts, getNewArrivals } from "@/lib/products";

export default function HomePage() {
  const featured = getFeaturedProducts(8);
  const arrivals = getNewArrivals(8);
  const coatStory = STORIES[0];

  return (
    <>
      <Hero />

      <Container className="py-20 text-center lg:py-28">
        <p className="eyebrow">The house</p>
        <p className="display mx-auto mt-5 max-w-3xl text-3xl leading-tight sm:text-4xl lg:text-[2.75rem]">
          Considered clothing for a quieter kind of luxury. Two hundred pieces, made slowly in Italy, Scotland and Portugal, in colours chosen to
          be lived in.
        </p>
      </Container>

      <Container>
        <CollectionTiles collections={FEATURED_COLLECTIONS} />
      </Container>

      <Container className="py-24 lg:py-32">
        <SectionHeading eyebrow="The edit" title="Pieces we keep returning to" link={{ href: "/collections/icons", label: "View the icons" }} className="mb-12" />
        <ProductGrid products={featured} />
      </Container>

      <Container>
        <EditorialSplit story={coatStory} />
      </Container>

      <div className="mt-24 lg:mt-32">
        <ColourPromo />
      </div>

      <Container className="py-24 lg:py-32">
        <SectionHeading eyebrow="Autumn 2026" title="New arrivals" link={{ href: "/collections/new-arrivals", label: "Shop all new" }} className="mb-12" />
        <ProductRail products={arrivals} />
      </Container>

      <Container className="pb-8">
        <SectionHeading eyebrow="Journal" title="Notes from the atelier" link={{ href: "/journal", label: "All stories" }} className="mb-12" />
        <JournalTeaser stories={STORIES.slice(1, 4)} />
      </Container>

      <Container className="mt-24 grid gap-10 border-t border-line pt-14 sm:grid-cols-2 lg:grid-cols-4 lg:mt-32">
        {[
          ["Pure fibres only", "100% silk, cotton, wool, cashmere and leather. No blends, no shortcuts, checked twice before dispatch."],
          ["Free shipping", "On every order over $75, with free returns within thirty days."],
          ["Made slowly", "Small workshops in Italy, Scotland, Portugal and India. Lifetime repair on everything we make."],
          ["Colour analysis", "Know your season, and whether a piece was made for you, before you buy."],
        ].map(([t, d]) => (
          <div key={t}>
            <p className="font-serif text-xl">{t}</p>
            <p className="mt-2 text-sm leading-relaxed text-stone">{d}</p>
          </div>
        ))}
      </Container>
    </>
  );
}
