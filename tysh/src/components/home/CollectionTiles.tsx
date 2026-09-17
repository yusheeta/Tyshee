import Link from "next/link";
import { EditorialImage } from "@/components/image/EditorialImage";
import type { Collection } from "@/data/collections";
import { getCollectionHero } from "@/lib/products";
import { cn } from "@/lib/utils";

export function CollectionTiles({ collections }: { collections: Collection[] }) {
  const [a, b, c, ...rest] = collections;
  return (
    <section aria-labelledby="collections-heading">
      <h2 id="collections-heading" className="sr-only">
        Collections
      </h2>
      <div className="grid gap-4 md:grid-cols-3 md:gap-6">
        {[a, b, c].map((col) => (
          <Tile key={col.slug} collection={col} ar="3:4" sizes="(min-width: 768px) 33vw, 100vw" />
        ))}
      </div>
      {rest.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3 md:mt-6 md:gap-6">
          {rest.map((col) => (
            <Tile key={col.slug} collection={col} ar="4:3" sizes="(min-width: 640px) 33vw, 100vw" compact />
          ))}
        </div>
      )}
    </section>
  );
}

function Tile({ collection, ar, sizes, compact = false }: { collection: Collection; ar: "3:4" | "4:3"; sizes: string; compact?: boolean }) {
  const hero = getCollectionHero(collection.slug);
  if (!hero) return null;
  return (
    <Link href={`/collections/${collection.slug}`} className="group relative block overflow-hidden">
      <EditorialImage id={hero.id} alt={hero.alt} crop={hero.crop} tone={hero.tone} ar={ar} sizes={sizes} quality={70} imgClassName="transition-transform duration-[1400ms] ease-[var(--ease-luxe)] group-hover:scale-[1.03] motion-reduce:transform-none" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" aria-hidden="true" />
      <div className={cn("absolute inset-x-0 bottom-0 p-5 text-white sm:p-7", compact && "sm:p-5")}>
        <p className="eyebrow !text-white/75">{collection.eyebrow}</p>
        <p className={cn("display mt-2 text-3xl", compact ? "sm:text-2xl" : "sm:text-4xl")}>{collection.title}</p>
      </div>
    </Link>
  );
}
