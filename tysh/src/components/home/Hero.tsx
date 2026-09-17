import Link from "next/link";
import { ArtDirectedImage } from "@/components/image/ArtDirectedImage";
import hero from "@/data/hero.json";
import type { CropStrategy } from "@/lib/types";

export function Hero() {
  return (
    <section className="relative h-[82svh] min-h-[540px] max-h-[960px] w-full overflow-hidden bg-bone">
      <ArtDirectedImage
        id={hero.id}
        alt={hero.alt}
        crop={hero.crop as CropStrategy}
        mobileAr="3:4"
        desktopAr="16:9"
        quality={65}
        tone={hero.tone}
        imgClassName="object-cover"
        imgStyle={{ objectPosition: hero.focal }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto max-w-[1440px] px-5 pb-10 sm:px-8 sm:pb-14 lg:px-12 lg:pb-20">
          <p className="eyebrow !text-white/80">{hero.eyebrow}</p>
          <h1 className="display mt-4 max-w-3xl text-[2.75rem] text-white sm:text-6xl lg:text-7xl xl:text-[5.5rem]">
            {hero.headline[0]}
            <br />
            {hero.headline[1]}
          </h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/collections/women" className="btn border-white bg-white text-black hover:bg-transparent hover:text-white">
              Shop Women
            </Link>
            <Link href="/collections/men" className="btn border-white/70 bg-transparent text-white hover:border-white hover:bg-white hover:text-black">
              Shop Men
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
