import Link from "next/link";
import { EditorialImage } from "@/components/image/EditorialImage";
import type { Story } from "@/data/journal";

export function JournalTeaser({ stories }: { stories: Story[] }) {
  return (
    <div className="grid gap-8 sm:grid-cols-3">
      {stories.map((s) => (
        <Link key={s.slug} href={`/journal/${s.slug}`} className="group block">
          <EditorialImage id={s.hero.id} alt={s.hero.alt} crop={s.hero.crop} ar="4:5" sizes="(min-width: 640px) 33vw, 100vw" quality={70} imgClassName="transition-transform duration-[1400ms] ease-[var(--ease-luxe)] group-hover:scale-[1.03] motion-reduce:transform-none" />
          <p className="eyebrow mt-5">{s.eyebrow}</p>
          <h3 className="font-serif mt-2 text-2xl leading-tight">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone">{s.dek}</p>
        </Link>
      ))}
    </div>
  );
}
