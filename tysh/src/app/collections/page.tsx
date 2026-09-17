import type { Metadata } from "next";
import Link from "next/link";
import { EditorialImage } from "@/components/image/EditorialImage";
import { Container } from "@/components/ui/Container";
import { COLLECTIONS } from "@/data/collections";
import { getCollectionHero, getCollectionProducts } from "@/lib/products";

export const metadata: Metadata = { title: "Collections", description: "Every TYSHEE collection, from ready-to-wear to leather goods, footwear and jewellery." };

export default function CollectionsPage() {
  // Top-level collections only; sub-categories are reached from their parent page.
  const list = COLLECTIONS.filter((c) => c.slug !== "all" && !c.parent);
  return (
    <Container className="pt-14 lg:pt-20">
      <p className="eyebrow">Browse</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl lg:text-7xl">Collections</h1>
      <ul className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {list.map((c, i) => {
          const hero = getCollectionHero(c.slug);
          if (!hero) return null;
          return (
          <li key={c.slug}>
            <Link href={`/collections/${c.slug}`} className="group block">
              <EditorialImage id={hero.id} alt={hero.alt} crop={hero.crop} tone={hero.tone} ar="3:4" sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" preload={i < 2} quality={70} imgClassName="transition-transform duration-[1400ms] ease-[var(--ease-luxe)] group-hover:scale-[1.03] motion-reduce:transform-none" />
              <p className="eyebrow mt-4">{c.eyebrow}</p>
              <p className="font-serif mt-1 text-xl">{c.title}</p>
              <p className="mt-1 text-xs text-stone">{getCollectionProducts(c.slug).length} pieces</p>
            </Link>
          </li>
          );
        })}
      </ul>
    </Container>
  );
}
