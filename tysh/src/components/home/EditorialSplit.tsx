import Link from "next/link";
import { EditorialImage } from "@/components/image/EditorialImage";
import type { Story } from "@/data/journal";
import { cn } from "@/lib/utils";

export function EditorialSplit({ story, reverse = false }: { story: Story; reverse?: boolean }) {
  return (
    <section className={cn("grid items-center gap-10 lg:grid-cols-12 lg:gap-16", reverse && "lg:[&>*:first-child]:order-2")}>
      <div className="lg:col-span-7">
        <EditorialImage id={story.hero.id} alt={story.hero.alt} crop={story.hero.crop} ar="4:5" sizes="(min-width: 1024px) 58vw, 100vw" quality={70} />
      </div>
      <div className="lg:col-span-5">
        <p className="eyebrow">{story.eyebrow}</p>
        <h2 className="display mt-4 text-4xl sm:text-5xl">{story.title}</h2>
        <p className="measure mt-6 text-[15px] leading-relaxed text-graphite">{story.dek}</p>
        <p className="measure mt-4 text-[15px] leading-relaxed text-graphite">{story.body[0]}</p>
        <Link href={`/journal/${story.slug}`} className="btn btn-ghost mt-8">
          Read the story
        </Link>
      </div>
    </section>
  );
}
