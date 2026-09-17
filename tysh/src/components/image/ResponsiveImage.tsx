import { preload } from "react-dom";
import { ASPECT_CLASS, tonePlaceholder, type AspectRatio } from "@/lib/images";
import { buildImageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";

/** Candidate widths we are willing to emit. */
const LADDER = [320, 480, 640, 768, 960, 1024, 1280, 1600, 1920];

/**
 * Derive srcset candidate widths from a `sizes` attribute. Fixed-pixel sizes get 1×/2×/3×
 * variants; viewport-relative sizes get the ladder clipped to what any plausible viewport
 * × device-pixel-ratio could actually select. Contexts that know better pass `widths`.
 */
export function widthsForSizes(sizes: string): number[] {
  const px = [...sizes.matchAll(/(\d+)px(?!\))/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= 800);
  const hasVw = /\d+vw/.test(sizes);
  if (px.length && !hasVw) {
    return [...new Set(px.flatMap((p) => [p, p * 2, p * 3]))].sort((a, b) => a - b);
  }
  const vw = [...sizes.matchAll(/(\d+)vw/g)].map((m) => Number(m[1]) / 100);
  const fMax = vw.length ? Math.max(...vw) : 1;
  const fMin = vw.length ? Math.min(...vw) : 1;
  const upper = Math.min(1920, Math.round(fMax * 2560));
  const lower = Math.max(320, Math.round(fMin * 360 * 1.5));
  const out = LADDER.filter((w) => w >= lower && w <= upper);
  return out.length >= 3 ? out : LADDER.slice(0, 3);
}

export interface ResponsiveImageProps {
  /** Canonical source (photoSrc) carrying the virtual `ar` / `crop` params. */
  src: string;
  alt: string;
  sizes: string;
  widths?: number[];
  ar?: AspectRatio;
  quality?: number;
  /** LCP candidate: eager, high priority, and a <link rel="preload"> in <head>. */
  preload?: boolean;
  /**
   * Non-LCP images default to `fetchpriority="low"` so the hero always wins the bandwidth
   * race on slow connections. Pass `false` for images that should compete normally.
   */
  lowPriority?: boolean;
  tone?: string;
  className?: string;
  imgClassName?: string;
}

/**
 * Server-rendered responsive image. Zero client JavaScript, zero hydration.
 *
 * Why not `next/image` here? Its <img> is a client component: for a 24-card grid that means
 * 24 hydrated components whose 12-candidate srcsets are serialised into both the HTML and
 * the RSC payload. On a throttled phone that parsing and hydration cost more than the images
 * themselves. This component emits the same responsive markup (srcset, sizes, lazy loading,
 * fetch priority, intrinsic dimensions, a first-frame placeholder) as plain HTML, with the
 * candidate list tailored to the slot, and preloads the LCP image via React Float.
 */
export function ResponsiveImage({ src, alt, sizes, widths, ar = "3:4", quality = 75, preload: isLcp = false, lowPriority = true, tone = "#D8D1C4", className, imgClassName }: ResponsiveImageProps) {
  const candidates = widths ?? widthsForSizes(sizes);
  const srcSet = candidates.map((w) => `${buildImageUrl({ src, width: w, quality })} ${w}w`).join(", ");
  const fallbackWidth = candidates[Math.min(candidates.length - 1, Math.floor(candidates.length / 2))];
  const fallback = buildImageUrl({ src, width: fallbackWidth, quality });
  const [aw, ah] = ar.split(":").map(Number);
  const height = Math.round((fallbackWidth * ah) / aw);

  if (isLcp) preload(fallback, { as: "image", imageSrcSet: srcSet, imageSizes: sizes, fetchPriority: "high" });

  return (
    <div className={cn("relative overflow-hidden bg-bone", ASPECT_CLASS[ar], className)} style={{ backgroundImage: `url("${tonePlaceholder(tone, ar)}")`, backgroundSize: "cover" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- deliberate: see component docblock */}
      <img
        src={fallback}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={fallbackWidth}
        height={height}
        loading={isLcp ? "eager" : "lazy"}
        fetchPriority={isLcp ? "high" : lowPriority ? "low" : "auto"}
        decoding="async"
        className={cn("absolute inset-0 h-full w-full object-cover", imgClassName)}
      />
    </div>
  );
}
