import type { Metadata } from "next";
import Link from "next/link";
import { EditorialImage } from "@/components/image/EditorialImage";
import { Container } from "@/components/ui/Container";
import { STORIES } from "@/data/journal";

export const metadata: Metadata = { title: "Journal", description: "Notes from the TYSHEE atelier on craft, colour and the pieces we keep returning to." };

export default function JournalPage() {
  const [lead, ...rest] = [...STORIES].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Container className="pt-14 lg:pt-20">
      <p className="eyebrow">Journal</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl lg:text-7xl">Notes from the atelier</h1>

      <Link href={`/journal/${lead.slug}`} className="group mt-14 grid gap-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <EditorialImage id={lead.hero.id} alt={lead.hero.alt} crop={lead.hero.crop} ar="16:9" sizes="(min-width: 1024px) 66vw, 100vw" preload quality={70} imgClassName="transition-transform duration-[1400ms] ease-[var(--ease-luxe)] group-hover:scale-[1.02] motion-reduce:transform-none" />
        </div>
        <div className="lg:col-span-4 lg:pb-4">
          <p className="eyebrow">{lead.eyebrow}</p>
          <h2 className="display mt-3 text-4xl">{lead.title}</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-graphite">{lead.dek}</p>
        </div>
      </Link>

      <ul className="mt-20 grid gap-10 sm:grid-cols-3">
        {rest.map((s) => (
          <li key={s.slug}>
            <Link href={`/journal/${s.slug}`} className="group block">
              <EditorialImage id={s.hero.id} alt={s.hero.alt} crop={s.hero.crop} ar="4:5" sizes="(min-width: 640px) 33vw, 100vw" quality={70} imgClassName="transition-transform duration-[1400ms] ease-[var(--ease-luxe)] group-hover:scale-[1.03] motion-reduce:transform-none" />
              <p className="eyebrow mt-5">{s.eyebrow}</p>
              <h2 className="font-serif mt-2 text-2xl leading-tight">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone">{s.dek}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
