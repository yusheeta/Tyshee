import { deltaE2000, hexToLab, hexToLch, hueFamily, labToLch, type LCh } from "./convert";
import type { Season } from "./seasons";

export type Rating = "made-for-you" | "works-well" | "wear-with-intention" | "not-your-best";

export interface MatchResult {
  score: number;
  rating: Rating;
  label: string;
  reason: string;
  /** Closest palette colour, hex. */
  nearest: string;
  distance: number;
}

export const RATING_LABEL: Record<Rating, string> = {
  "made-for-you": "Made for you",
  "works-well": "Works well",
  "wear-with-intention": "Wear with intention",
  "not-your-best": "Not your best",
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Warmth of a colour in [-1, 1] from its hue; low-chroma colours are near zero. */
export function warmth(lch: LCh): number {
  if (lch.C < 6) return 0;
  // Warm peak at ~70° (orange-yellow), cool peak at ~250° (blue).
  const rad = ((lch.h - 70) * Math.PI) / 180;
  const w = Math.cos(rad); // 1 at 70°, -1 at 250°
  const chromaWeight = clamp01((lch.C - 6) / 24); // fades in between C=6 and C=30
  return w * chromaWeight;
}

/**
 * Score a garment colour against a season. Blends perceptual distance to the palette
 * with alignment on the three axes the seasonal system is built on.
 */
export function scoreColour(hex: string, season: Season): MatchResult {
  const lab = hexToLab(hex);
  const lch = labToLch(lab);
  const swatches = [...season.palette, ...season.neutrals];

  let nearest = swatches[0];
  let distance = Infinity;
  for (const s of swatches) {
    const d = deltaE2000(lab, hexToLab(s));
    if (d < distance) {
      distance = d;
      nearest = s;
    }
  }
  const distanceScore = clamp01(1 - distance / 32);

  // Undertone alignment
  const seasonWarmth = season.traits.undertone === "warm" ? 1 : season.traits.undertone === "cool" ? -1 : 0;
  const w = warmth(lch);
  const warmthAlign = season.traits.undertone === "neutral" ? 1 - Math.abs(w) * 0.4 : 1 - Math.abs(w - seasonWarmth) / 2;

  // Depth alignment
  let depthAlign = 1;
  if (season.traits.depth === "light") depthAlign = lch.L >= 55 ? 1 : clamp01(0.35 + lch.L / 110);
  if (season.traits.depth === "deep") depthAlign = lch.L <= 45 || lch.C >= 35 || lch.L >= 92 ? 1 : clamp01(0.5 + (45 - lch.L) / 90 + 0.4);

  // Clarity alignment
  let clarityAlign = 1;
  const isAchromaticExtreme = lch.C < 6 && (lch.L < 22 || lch.L > 88);
  if (season.traits.clarity === "bright") clarityAlign = lch.C >= 30 || isAchromaticExtreme ? 1 : clamp01(0.45 + lch.C / 60);
  if (season.traits.clarity === "soft") clarityAlign = lch.C <= 34 ? 1 : clamp01(1 - (lch.C - 34) / 45);

  const score = Math.round(100 * (0.5 * distanceScore + 0.22 * warmthAlign + 0.14 * depthAlign + 0.14 * clarityAlign));
  const rating: Rating = score >= 78 ? "made-for-you" : score >= 62 ? "works-well" : score >= 46 ? "wear-with-intention" : "not-your-best";

  return {
    score,
    rating,
    label: RATING_LABEL[rating],
    reason: explain({ lch, season, rating, warmthAlign, depthAlign, clarityAlign }),
    nearest,
    distance,
  };
}

function explain({ lch, season, rating, warmthAlign, depthAlign, clarityAlign }: { lch: LCh; season: Season; rating: Rating; warmthAlign: number; depthAlign: number; clarityAlign: number }): string {
  const family = hueFamily(lch);
  const name = season.label;
  if (rating === "made-for-you") {
    return `This ${family} sits squarely inside the ${name} palette: the warmth, depth and clarity all agree with your colouring.`;
  }
  const weakest = Math.min(warmthAlign, depthAlign, clarityAlign);
  if (weakest === warmthAlign && warmthAlign < 0.75) {
    return season.traits.undertone === "warm"
      ? `Its cool cast can flatten a warm complexion. As a ${name}, wear this ${family} away from the face or pair it with camel or cream.`
      : `Its warmth can read sallow against cool skin. As a ${name}, keep this ${family} below the neckline or balance it with a cool neutral.`;
  }
  if (weakest === depthAlign && depthAlign < 0.75) {
    return season.traits.depth === "light"
      ? `The depth of this ${family} can overpower light colouring. Try it as trousers or a bag rather than a knit or coat.`
      : `This ${family} is lighter than your natural contrast. Anchor it with one of your deep neutrals.`;
  }
  if (weakest === clarityAlign && clarityAlign < 0.75) {
    return season.traits.clarity === "bright"
      ? `A muted ${family} can dull a bright ${name}. Add a crisp neutral or a saturated accent near the face.`
      : `This ${family} is more saturated than the soft ${name} palette prefers. It works best in small doses.`;
  }
  return rating === "works-well"
    ? `A ${family} that lives close to your ${name} palette. Not a signature colour, but an easy one to wear.`
    : `A ${family} at the edge of your ${name} palette. Wearable, but it will not do the work your best colours do.`;
}

export interface ColourwayLike {
  name: string;
  hex: string;
}

/** Score each colourway and return the best, so a product is judged by its most flattering option. */
export function scoreColourways<T extends ColourwayLike>(colourways: T[], season: Season): { colourway: T; result: MatchResult }[] {
  return colourways.map((colourway) => ({ colourway, result: scoreColour(colourway.hex, season) })).sort((a, b) => b.result.score - a.result.score);
}

export function bestMatch<T extends ColourwayLike>(colourways: T[], season: Season): { colourway: T; result: MatchResult } {
  return scoreColourways(colourways, season)[0];
}

export { hexToLch };
