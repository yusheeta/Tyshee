import type { Metadata } from "next";
import { ColourAnalysis } from "@/components/colour/ColourAnalysis";
import { SeasonSwatches } from "@/components/colour/SeasonSwatches";
import { EditorialImage } from "@/components/image/EditorialImage";
import { Container } from "@/components/ui/Container";
import { SEASONS } from "@/lib/colour/seasons";

export const metadata: Metadata = {
  title: "Personal Colour Analysis",
  description: "Find your colour season in one minute, entirely in your browser, and see which TYSHEE pieces were made for your colouring.",
};

export default function ColourAnalysisPage() {
  return (
    <>
      <Container className="grid gap-10 pt-14 lg:grid-cols-12 lg:items-center lg:gap-16 lg:pt-20">
        <div className="lg:col-span-6">
          <p className="eyebrow">Personal colour analysis</p>
          <h1 className="display mt-3 text-5xl sm:text-6xl lg:text-7xl">Know your season before you buy.</h1>
          <p className="measure mt-6 text-[16px] leading-relaxed text-graphite">
            In Seoul, personal colour analysis is an appointment people fly in for: a consultant drapes fabric after fabric until the face brightens
            or dulls, then names your season. We measure the same three properties, undertone, depth and clarity, from a photograph or six
            questions, and score every piece in the collection against your palette.
          </p>
          <ul className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
            {[
              ["Undertone", "Warm, cool or neutral. Read from the hue angle of your skin in CIELAB, the colour space dermatologists use."],
              ["Depth", "Light, medium or deep. Read from ITA°, the Individual Typology Angle, from your skin's lightness and yellowness."],
              ["Clarity", "Bright or soft. The contrast between your features, which a photo cannot reliably judge, so we ask."],
            ].map(([t, d]) => (
              <li key={t} className="border-t border-line pt-4">
                <p className="font-serif text-xl">{t}</p>
                <p className="mt-1 text-xs leading-relaxed text-stone">{d}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-stone">Your photo is analysed on your device and never uploaded. Only the resulting season is saved.</p>
        </div>
        <div className="lg:col-span-6">
          <EditorialImage id="photo-1515886657613-9f3515b0c78f" alt="Editorial portrait in colour" crop="faces,entropy" ar="4:5" sizes="(min-width: 1024px) 50vw, 100vw" preload quality={70} />
        </div>
      </Container>

      <section className="mt-24 bg-bone py-20 lg:mt-32 lg:py-28" id="analyse">
        <Container className="max-w-3xl">
          <ColourAnalysis />
        </Container>
      </section>

      <Container className="mt-24 lg:mt-32">
        <p className="eyebrow">The twelve seasons</p>
        <h2 className="display mt-3 text-4xl sm:text-5xl">Four families, three sub-tones each</h2>
        <ul className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {SEASONS.map((s) => (
            <li key={s.id}>
              <SeasonSwatches season={s} className="h-12" />
              <p className="eyebrow mt-4 capitalize">{s.family}</p>
              <p className="font-serif mt-1 text-2xl">{s.label}</p>
              <p className="mt-1 text-sm italic text-graphite">{s.tagline}</p>
              <p className="mt-3 text-sm leading-relaxed text-stone">{s.description}</p>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
