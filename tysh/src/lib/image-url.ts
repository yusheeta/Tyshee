import { IMAGE_CDN_MODE } from "@/lib/image-origin";

/**
 * Pure URL builder shared by the client-side next/image loader and server code
 * (Open Graph tags, JSON-LD, Stripe line-item thumbnails). No directives, so it can
 * be called from either environment.
 *
 * Input URLs carry two virtual params: `ar` (aspect ratio, e.g. 3:4) and `crop`
 * (imgix crop strategy). Output is a fully qualified CDN URL sized for one srcset
 * candidate, with `auto=format` so the CDN negotiates AVIF/WebP.
 */
export interface ImageUrlParams {
  src: string;
  width: number;
  quality?: number;
}

function parseAspect(ar: string | null): number | null {
  if (!ar) return null;
  const [w, h] = ar.split(":").map(Number);
  if (!w || !h) return null;
  return w / h;
}

/**
 * DPR-aware quality. Candidates wider than ~1100px are only ever selected by high-density
 * screens (2–3× phones, retina laptops), where compression artefacts are invisible, so we
 * trade quality for bytes as width grows. This is the single biggest lever on mobile LCP.
 */
export function adaptiveQuality(width: number, requested: number): number {
  if (width >= 1600) return Math.min(requested, 55);
  if (width >= 1100) return Math.min(requested, 62);
  return requested;
}

export function buildImageUrl({ src, width, quality }: ImageUrlParams): string {
  if (src.startsWith("/") || src.startsWith("data:")) return src;

  const url = new URL(src);
  const q = adaptiveQuality(width, quality ?? 75);
  const ratio = parseAspect(url.searchParams.get("ar"));
  url.searchParams.delete("ar");

  url.searchParams.set("w", String(width));
  if (ratio) {
    url.searchParams.set("h", String(Math.round(width / ratio)));
    url.searchParams.set("fit", "crop");
    if (!url.searchParams.has("crop")) url.searchParams.set("crop", "entropy");
  }
  url.searchParams.set("q", String(q));
  url.searchParams.set("auto", "format");

  if (IMAGE_CDN_MODE === "cloudflare") {
    // Cloudflare Image Transformations: /cdn-cgi/image/<options>/<source-url>
    // The zone resizes and caches each variant at the edge; format=auto serves AVIF/WebP.
    const opts = [`width=${width}`, `quality=${q}`, "format=auto", "fit=cover"];
    if (ratio) opts.push(`height=${Math.round(width / ratio)}`);
    for (const k of ["w", "h", "q", "fit", "crop", "auto"]) url.searchParams.delete(k);
    return `/cdn-cgi/image/${opts.join(",")}/${url.toString()}`;
  }

  return url.toString();
}
