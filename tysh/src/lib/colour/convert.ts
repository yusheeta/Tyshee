/**
 * Colour science helpers: sRGB ⇄ CIELAB / LCh(ab), and CIEDE2000.
 * D65 reference white, 2° observer. Pure functions, safe on server and client.
 */
export type RGB = [number, number, number];
export interface Lab {
  L: number;
  a: number;
  b: number;
}
export interface LCh {
  L: number;
  C: number;
  h: number;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;

export function rgbToLab([r, g, b]: RGB): Lab {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / Xn);
  const fy = f(Y / Yn);
  const fz = f(Z / Zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToLch({ L, a, b }: Lab): LCh {
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex));
}

export function hexToLch(hex: string): LCh {
  return labToLch(hexToLab(hex));
}

/** CIEDE2000 colour difference. Sharma, Wu & Dalal (2005) reference implementation. */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = C1p === 0 ? 0 : ((Math.atan2(b1, a1p) * deg) + 360) % 360;
  const h2p = C2p === 0 ? 0 : ((Math.atan2(b2, a2p) * deg) + 360) % 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp: number;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp: number;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * rad) +
    0.24 * Math.cos(2 * hbarp * rad) +
    0.32 * Math.cos((3 * hbarp + 6) * rad) -
    0.2 * Math.cos((4 * hbarp - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;

  return Math.sqrt(
    Math.pow(dLp / SL, 2) + Math.pow(dCp / SC, 2) + Math.pow(dHp / SH, 2) + RT * (dCp / SC) * (dHp / SH),
  );
}

/** Human-readable hue family for a colour, used in explanations. */
export function hueFamily(lch: LCh): string {
  if (lch.C < 6) return lch.L > 85 ? "white" : lch.L < 22 ? "black" : "grey";
  const h = lch.h;
  if (lch.C < 16) {
    if (h >= 40 && h < 110) return lch.L > 60 ? "warm neutral" : "brown";
    return "cool neutral";
  }
  if (h < 20 || h >= 345) return "red";
  if (h < 50) return lch.L > 60 ? "coral" : "rust";
  if (h < 75) return lch.L > 60 ? "peach" : "tobacco";
  if (h < 100) return lch.L > 70 ? "cream" : "gold";
  if (h < 140) return "olive";
  if (h < 175) return "green";
  if (h < 215) return "teal";
  if (h < 265) return "blue";
  if (h < 300) return "violet";
  if (h < 345) return "plum";
  return "red";
}
