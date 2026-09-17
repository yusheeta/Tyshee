import { labToLch, rgbToHex, rgbToLab, type Lab, type LCh, type RGB } from "./convert";
import type { Clarity, Depth, Traits, Undertone } from "./seasons";

export interface SkinReading {
  hex: string;
  lab: Lab;
  lch: LCh;
  /** Individual Typology Angle, degrees. Dermatology's standard skin-lightness measure. */
  ita: number;
  undertone: Undertone;
  depth: Depth;
  /** How many of the sampled pixels passed the skin filter. */
  sampleSize: number;
}

/**
 * ITA° = arctan((L* − 50) / b*) · 180/π  (Chardon et al., 1991).
 * > 55 very light · 41–55 light · 28–41 intermediate · 10–28 tan · −30–10 brown · < −30 dark
 */
export function ita(lab: Lab): number {
  return (Math.atan2(lab.L - 50, lab.b) * 180) / Math.PI;
}

export function depthFromIta(value: number): Depth {
  if (value > 41) return "light";
  if (value > 19) return "medium";
  return "deep";
}

/**
 * Undertone from the hue angle of skin in LCh(ab). Skin hues sit roughly between 35°
 * (pink/red-leaning, cool) and 80° (yellow/olive-leaning, warm). Thresholds are
 * heuristic and deliberately leave a neutral band in the middle.
 */
export function undertoneFromHue(h: number): Undertone {
  if (h >= 60) return "warm";
  if (h <= 49) return "cool";
  return "neutral";
}

/** Broad "could this pixel be skin" gate, used to reject hair, background and lips. */
function plausibleSkin(lch: LCh): boolean {
  return lch.L >= 18 && lch.L <= 96 && lch.h >= 15 && lch.h <= 95 && lch.C >= 6 && lch.C <= 55;
}

/**
 * Analyse a set of sampled RGB pixels. Outliers are trimmed by taking the middle 60% of
 * lightness so specular highlights and shadows do not skew the average.
 */
export function analyseSkinPixels(pixels: RGB[]): SkinReading | null {
  const labs = pixels.map(rgbToLab).filter((lab) => plausibleSkin(labToLch(lab)));
  if (labs.length < 12) return null;
  labs.sort((x, y) => x.L - y.L);
  const lo = Math.floor(labs.length * 0.2);
  const hi = Math.ceil(labs.length * 0.8);
  const core = labs.slice(lo, hi);
  const mean = core.reduce((acc, l) => ({ L: acc.L + l.L, a: acc.a + l.a, b: acc.b + l.b }), { L: 0, a: 0, b: 0 });
  const lab: Lab = { L: mean.L / core.length, a: mean.a / core.length, b: mean.b / core.length };
  const lch = labToLch(lab);
  const angle = ita(lab);
  return {
    hex: labToApproxHex(lab),
    lab,
    lch,
    ita: angle,
    undertone: undertoneFromHue(lch.h),
    depth: depthFromIta(angle),
    sampleSize: labs.length,
  };
}

/** Lab → sRGB hex (for displaying the sampled swatch). */
export function labToApproxHex({ L, a, b }: Lab): string {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const finv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = 0.95047 * finv(fx);
  const Y = 1.0 * finv(fy);
  const Z = 1.08883 * finv(fz);
  let R = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  let G = X * -0.969266 + Y * 1.8760108 + Z * 0.041556;
  let B = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;
  const gamma = (c: number) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(1, v)) * 255;
  };
  R = gamma(R);
  G = gamma(G);
  B = gamma(B);
  return rgbToHex([R, G, B]);
}

// ------------------------------------------------------------------ Quiz ----
export interface QuizQuestion {
  id: string;
  prompt: string;
  help?: string;
  options: { label: string; undertone?: Undertone; depth?: Depth; clarity?: Clarity }[];
}

export const QUIZ: QuizQuestion[] = [
  {
    id: "veins",
    prompt: "In daylight, the veins on the inside of your wrist look…",
    options: [
      { label: "Green or olive", undertone: "warm" },
      { label: "Blue or purple", undertone: "cool" },
      { label: "Hard to say, a mix of both", undertone: "neutral" },
    ],
  },
  {
    id: "metal",
    prompt: "Which metal makes your skin look healthier?",
    options: [
      { label: "Gold", undertone: "warm" },
      { label: "Silver", undertone: "cool" },
      { label: "Both look equally good", undertone: "neutral" },
    ],
  },
  {
    id: "sun",
    prompt: "In the sun, your skin usually…",
    options: [
      { label: "Tans easily, rarely burns", undertone: "warm", depth: "deep" },
      { label: "Burns first, then tans a little", undertone: "neutral", depth: "medium" },
      { label: "Burns and stays pink", undertone: "cool", depth: "light" },
    ],
  },
  {
    id: "white",
    prompt: "Pure white next to your face looks…",
    options: [
      { label: "Crisp and flattering", undertone: "cool", clarity: "bright" },
      { label: "A little harsh; cream is softer", undertone: "warm", clarity: "soft" },
      { label: "Fine either way", undertone: "neutral" },
    ],
  },
  {
    id: "depth",
    prompt: "Your natural hair and eye colour are…",
    help: "Think of your hair colour before any dye.",
    options: [
      { label: "Light: blonde, light brown, blue or green eyes", depth: "light" },
      { label: "Medium: brown hair, hazel or brown eyes", depth: "medium" },
      { label: "Deep: dark brown or black hair, dark eyes", depth: "deep" },
    ],
  },
  {
    id: "contrast",
    prompt: "Compared with your skin, your hair and features are…",
    options: [
      { label: "Strongly contrasting and sharp", clarity: "bright" },
      { label: "Somewhere in between", clarity: "medium" },
      { label: "Blended and soft, low contrast", clarity: "soft" },
    ],
  },
];

/** Aggregate quiz answers (option index per question) into traits by weighted vote. */
export function quizToTraits(answers: Record<string, number>): Traits {
  const u: Record<Undertone, number> = { warm: 0, cool: 0, neutral: 0 };
  const d: Record<Depth, number> = { light: 0, medium: 0, deep: 0 };
  const c: Record<Clarity, number> = { bright: 0, medium: 0, soft: 0 };
  for (const q of QUIZ) {
    const o = q.options[answers[q.id] ?? -1];
    if (!o) continue;
    const w = q.id === "depth" || q.id === "contrast" ? 2 : 1;
    if (o.undertone) u[o.undertone] += w;
    if (o.depth) d[o.depth] += w;
    if (o.clarity) c[o.clarity] += w;
  }
  const top = <K extends string>(m: Record<K, number>, fallback: K): K =>
    (Object.entries(m) as [K, number][]).reduce((best, cur) => (cur[1] > best[1] ? cur : best), [fallback, -1])[0];
  return { undertone: top(u, "neutral"), depth: top(d, "medium"), clarity: top(c, "medium") };
}
