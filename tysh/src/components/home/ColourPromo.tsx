import Link from "next/link";
import { SEASONS } from "@/lib/colour/seasons";

export function ColourPromo() {
  const families = ["spring", "summer", "autumn", "winter"] as const;
  return (
    <section className="bg-bone py-20 lg:py-28">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:px-12">
        <div className="lg:col-span-5">
          <p className="eyebrow">Personal colour analysis</p>
          <h2 className="display mt-4 text-4xl sm:text-5xl">Does this colour suit you? Now you can know.</h2>
          <p className="measure mt-6 text-[15px] leading-relaxed text-graphite">
            The seasonal analysis people fly to Seoul for, built into every product page. Analyse your skin tone from a photo, entirely in your
            browser, or answer six questions. We will tell you your season and score every piece against your palette.
          </p>
          <Link href="/colour-analysis" className="btn mt-8">
            Find your season
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-7 lg:pl-8">
          {families.map((f) => {
            const s = SEASONS.filter((x) => x.family === f);
            return (
              <div key={f} className="border-t border-line pt-4">
                <p className="eyebrow capitalize">{f}</p>
                <div className="mt-3 flex h-10 overflow-hidden">
                  {s[1].palette.slice(0, 10).map((hex) => (
                    <span key={hex} className="flex-1" style={{ backgroundColor: hex }} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-stone">{s.map((x) => x.label).join(" · ")}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
