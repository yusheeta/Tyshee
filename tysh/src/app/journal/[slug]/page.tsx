import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialImage } from "@/components/image/EditorialImage";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getCollection } from "@/data/collections";
import { STORIES, getStory } from "@/data/journal";
import { getCollectionProducts, sortProducts } from "@/lib/products";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return STORIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const s = getStory(slug);
  return s ? { title: s.title, description: s.dek } : {};
}

export default async function StoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const story = getStory(slug);
  if (!story) notFound();
  const collection = getCollection(story.relatedCollection);
  const related = sortProducts(getCollectionProducts(story.relatedCollection), "featured").slice(0, 4);
  const date = new Date(story.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <article>
      <Container className="pt-14 text-center lg:pt-20">
        <p className="eyebrow">{story.eyebrow} · {date}</p>
        <h1 className="display mx-auto mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">{story.title}</h1>
        <p className="mx-auto mt-6 max-w-2xl font-serif text-xl italic leading-snug text-graphite sm:text-2xl">{story.dek}</p>
      </Container>

      <Container wide className="mt-12">
        <EditorialImage id={story.hero.id} alt={story.hero.alt} crop={story.hero.crop} ar="16:9" sizes="100vw" preload quality={70} className="max-h-[80vh]" />
      </Container>

      <Container className="mt-16 grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-6 lg:col-start-4">
          {story.body.map((para, i) => (
            <p key={i} className={i === 0 ? "font-serif text-2xl leading-snug first-letter:float-left first-letter:mr-3 first-letter:text-7xl first-letter:leading-[0.8]" : "mt-7 text-[16px] leading-[1.8] text-graphite"}>
              {para}
            </p>
          ))}
        </div>
      </Container>

      <Container className="mt-20 grid gap-6 sm:grid-cols-2">
        {story.images.map((im) => (
          <figure key={im.id}>
            <EditorialImage id={im.id} alt={im.alt} crop={im.crop} ar="4:5" sizes="(min-width: 640px) 50vw, 100vw" quality={70} />
            {im.caption && <figcaption className="mt-3 text-xs text-stone">{im.caption}</figcaption>}
          </figure>
        ))}
      </Container>

      {collection && related.length > 0 && (
        <Container className="mt-24 lg:mt-32">
          <SectionHeading eyebrow="From the story" title={collection.title} link={{ href: `/collections/${collection.slug}`, label: "Shop the collection" }} className="mb-12" />
          <ProductGrid products={related} />
        </Container>
      )}

      <Container className="mt-20 border-t border-line pt-10">
        <Link href="/journal" className="eyebrow link-underline text-ink">
          ← All stories
        </Link>
      </Container>
    </article>
  );
}
