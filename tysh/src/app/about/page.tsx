import type { Metadata } from "next";
import { EditorialImage } from "@/components/image/EditorialImage";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = { title: "About", description: "TYSHEE is a luxury house making considered clothing, leather goods and jewellery, slowly." };

export default function AboutPage() {
  return (
    <>
      <Container className="pt-14 lg:pt-20">
        <p className="eyebrow">The house</p>
        <h1 className="display mt-3 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">We make fewer things, and we make them properly.</h1>
      </Container>

      <Container wide className="mt-12">
        <EditorialImage id="photo-1445205170230-053b83016050" alt="Garments on a rail in the atelier" crop="entropy" ar="21:9" sizes="100vw" preload quality={65} className="max-h-[70vh]" />
      </Container>

      <Container className="mt-16 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="eyebrow">Founded 2019</p>
          <p className="mt-3 font-serif text-2xl leading-snug">Copenhagen, Florence, Seoul.</p>
        </div>
        <div className="space-y-6 text-[16px] leading-[1.8] text-graphite lg:col-span-6">
          <p>
            TYSHEE began with a single coat and a stubborn idea: that luxury should be quiet. No logos, no seasons chasing each other, no reason to
            replace a piece except that you have worn it out, which with our pieces takes a very long time.
          </p>
          <p>
            We work with a handful of family workshops in Italy, Scotland and Portugal, most of them for years now. Our knitwear comes from a mill in
            the Borders that has spun cashmere for four generations. Our leather goods are made outside Florence by thirty people, one bag per
            artisan, start to finish.
          </p>
          <p>
            The collection sits at around two hundred pieces. Some change with the season. Many do not. The Ines coat, the Aurelio crewneck and the
            structured tote have been made every year since the beginning, adjusted only when we find a way to make them better.
          </p>
          <p>
            In 2026 we added personal colour analysis to the storefront. It began as a service in our Seoul atelier and became the most requested
            appointment we offer. Now it lives on every product page, runs entirely in your browser, and asks nothing of you but a photograph or
            six questions.
          </p>
        </div>
      </Container>

      <Container className="mt-24 grid gap-6 sm:grid-cols-3">
        {[
          { id: "photo-1584917865442-de89df76afd3", alt: "Leather bag detail", crop: "entropy" as const, t: "Leather", d: "Vegetable-tanned, saddle-stitched, edge-painted in five coats." },
          { id: "photo-1576871337622-98d48d1cf531", alt: "Cashmere knit", crop: "faces,entropy" as const, t: "Cashmere", d: "Grade-A Mongolian fibre, knitted on vintage frames." },
          { id: "photo-1520975954732-35dd22299614", alt: "Tailored jacket", crop: "faces,entropy" as const, t: "Tailoring", d: "Half-canvassed, hand-padded lapels, natural shoulder." },
        ].map((x) => (
          <div key={x.id}>
            <EditorialImage id={x.id} alt={x.alt} crop={x.crop} ar="4:5" sizes="(min-width: 640px) 33vw, 100vw" quality={70} />
            <p className="font-serif mt-5 text-xl">{x.t}</p>
            <p className="mt-1 text-sm leading-relaxed text-stone">{x.d}</p>
          </div>
        ))}
      </Container>
    </>
  );
}
