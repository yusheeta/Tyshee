import { IMAGE_ORIGIN } from "@/lib/image-origin";

export type AspectRatio = "3:4" | "4:5" | "1:1" | "16:9" | "21:9" | "4:3" | "2:3";

export const ASPECT_CLASS: Record<AspectRatio, string> = {
  "3:4": "aspect-[3/4]",
  "4:5": "aspect-[4/5]",
  "1:1": "aspect-square",
  "16:9": "aspect-[16/9]",
  "21:9": "aspect-[21/9]",
  "4:3": "aspect-[4/3]",
  "2:3": "aspect-[2/3]",
};

/**
 * Build the canonical source URL for an Unsplash photo id.
 * The `ar`/`crop` params are consumed by the loader, never sent to the CDN.
 */
export function photoSrc(
  photoId: string,
  opts: { ar?: AspectRatio; crop?: "faces,entropy" | "entropy" | "edges" } = {},
): string {
  const url = new URL(`${IMAGE_ORIGIN}/${photoId}`);
  if (opts.ar) url.searchParams.set("ar", opts.ar);
  if (opts.crop) url.searchParams.set("crop", opts.crop);
  return url.toString();
}

/**
 * Tiny SVG low-quality placeholder in the product's dominant tone.
 * ~180 bytes inlined as a data URI: no network, no layout shift, and it paints
 * on the very first frame while the real image streams in.
 */
export type DataUri = `data:image/${string}`;

export function tonePlaceholder(hex: string, ar: AspectRatio = "3:4"): DataUri {
  const [w, h] = ar.split(":").map(Number);
  const light = mix(hex, "#ffffff", 0.35);
  const dark = mix(hex, "#000000", 0.12);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='0.4' y2='1'>` +
    `<stop offset='0' stop-color='${light}'/><stop offset='1' stop-color='${dark}'/>` +
    `</linearGradient></defs><rect width='${w}' height='${h}' fill='url(#g)'/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` as DataUri;
}

function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * `sizes` presets matching the storefront's grid breakpoints, with the srcset candidate
 * widths each slot can actually select (viewport × DPR). Fewer, better-targeted candidates
 * keep the HTML small without ever serving an undersized image.
 */
export const SIZES = {
  hero: "100vw",
  half: "(min-width: 1024px) 50vw, 100vw",
  gridTwoToFour: "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw",
  gridTwoToThree: "(min-width: 1024px) 33vw, 50vw",
  gallery: "(min-width: 1024px) 58vw, (min-width: 640px) 70vw, 88vw",
  thumb: "96px",
  cartThumb: "(min-width: 640px) 128px, 96px",
} as const;

export const WIDTHS = {
  /** Cards: 50vw on phones (≤ 720 device px), 33vw tablets, 25vw desktops (≤ 1280 on 2× 2560). */
  grid: [320, 400, 480, 640, 768, 1024, 1280],
  /** PDP gallery: 88vw phones (≤ 1100), 58vw desktops (≤ 1600 at 2× 1440). */
  gallery: [480, 640, 768, 1024, 1280, 1600],
  thumb: [96, 192, 288],
  cartThumb: [96, 128, 192, 256, 384],
} as const;
