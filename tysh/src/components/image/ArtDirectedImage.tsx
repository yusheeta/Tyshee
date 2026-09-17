import { preload } from "react-dom";
import { photoSrc, type AspectRatio } from "@/lib/images";
import { buildImageUrl } from "@/lib/image-url";
import type { CropStrategy } from "@/lib/types";
import { cn } from "@/lib/utils";

const MOBILE_WIDTHS = [480, 640, 768, 960, 1080];
const DESKTOP_WIDTHS = [1024, 1280, 1536, 1920, 2560];
const BREAKPOINT = 768;

interface Props {
  id: string;
  alt: string;
  crop?: CropStrategy;
  /** Crop served below the breakpoint (portrait phones). */
  mobileAr: AspectRatio;
  /** Crop served at and above the breakpoint. */
  desktopAr: AspectRatio;
  quality?: number;
  className?: string;
  imgClassName?: string;
  imgStyle?: React.CSSProperties;
  tone?: string;
}

function srcset(id: string, crop: CropStrategy, ar: AspectRatio, widths: number[], quality: number): string {
  const src = photoSrc(id, { ar, crop });
  return widths.map((w) => `${buildImageUrl({ src, width: w, quality })} ${w}w`).join(", ");
}

/**
 * Art-directed hero: a portrait crop for phones, a landscape crop for everything else,
 * each with its own srcset. A single 16:9 image sized for a 100vw portrait box would be
 * scaled to ~3× its width to cover the height and then mostly cropped away, so phones would
 * download a large landscape and still get a soft result. This serves the pixels that are
 * actually shown, at high fetch priority, and preloads the matching source per media query.
 */
export function ArtDirectedImage({ id, alt, crop = "faces,entropy", mobileAr, desktopAr, quality = 65, className, imgClassName, imgStyle, tone = "#D8D1C4" }: Props) {
  const mobile = srcset(id, crop, mobileAr, MOBILE_WIDTHS, quality);
  const desktop = srcset(id, crop, desktopAr, DESKTOP_WIDTHS, quality);
  const mobileMedia = `(max-width: ${BREAKPOINT - 1}px)`;
  const desktopMedia = `(min-width: ${BREAKPOINT}px)`;

  // React Float hoists these into <head> as <link rel="preload" as="image" media=…>.
  preload(buildImageUrl({ src: photoSrc(id, { ar: mobileAr, crop }), width: 768, quality }), { as: "image", imageSrcSet: mobile, imageSizes: "100vw", media: mobileMedia, fetchPriority: "high" });
  preload(buildImageUrl({ src: photoSrc(id, { ar: desktopAr, crop }), width: 1920, quality }), { as: "image", imageSrcSet: desktop, imageSizes: "100vw", media: desktopMedia, fetchPriority: "high" });

  return (
    <picture className={cn("absolute inset-0 block", className)} style={{ backgroundColor: tone }}>
      <source media={mobileMedia} srcSet={mobile} sizes="100vw" />
      <source media={desktopMedia} srcSet={desktop} sizes="100vw" />
      <img
        src={buildImageUrl({ src: photoSrc(id, { ar: desktopAr, crop }), width: 1280, quality })}
        alt={alt}
        fetchPriority="high"
        decoding="async"
        style={imgStyle}
        className={cn("absolute inset-0 h-full w-full object-cover", imgClassName)}
      />
    </picture>
  );
}
