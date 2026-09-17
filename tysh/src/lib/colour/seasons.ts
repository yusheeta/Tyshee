export type Family = "spring" | "summer" | "autumn" | "winter";
export type Undertone = "warm" | "cool" | "neutral";
export type Depth = "light" | "medium" | "deep";
export type Clarity = "bright" | "medium" | "soft";

export type SeasonId =
  | "light-spring"
  | "warm-spring"
  | "bright-spring"
  | "light-summer"
  | "cool-summer"
  | "soft-summer"
  | "soft-autumn"
  | "warm-autumn"
  | "deep-autumn"
  | "deep-winter"
  | "cool-winter"
  | "bright-winter";

export interface Traits {
  undertone: Undertone;
  depth: Depth;
  clarity: Clarity;
}

export interface Season {
  id: SeasonId;
  family: Family;
  label: string;
  tagline: string;
  description: string;
  traits: Traits;
  /** Signature colours, hex. */
  palette: string[];
  /** Best neutrals, hex. */
  neutrals: string[];
  avoid: string;
}

export const SEASONS: Season[] = [
  {
    id: "light-spring", family: "spring", label: "Light Spring",
    tagline: "Warm, light and delicate",
    description: "Low contrast between hair, skin and eyes, with a warm glow. Your colours are fresh and sunlit: peach, cream, mint and soft camel.",
    traits: { undertone: "warm", depth: "light", clarity: "medium" },
    palette: ["#F7E7CE", "#F4C2A1", "#F7B7A3", "#F9D77E", "#A8D5BA", "#9FD8CB", "#BFE0F5", "#E9C6E7", "#C8B48A", "#D2B48C", "#F2EDE4", "#9BB7D4"],
    neutrals: ["#F2EDE4", "#D6CCBC", "#B78B5C", "#8A8478"],
    avoid: "Black and stark white near the face; very dark, heavy colours.",
  },
  {
    id: "warm-spring", family: "spring", label: "Warm Spring",
    tagline: "Golden, warm and clear",
    description: "Distinctly golden skin and often warm hair. You carry saturated warm colours easily: marigold, coral, leaf green and camel.",
    traits: { undertone: "warm", depth: "medium", clarity: "medium" },
    palette: ["#E8A33C", "#E07A3F", "#D9534F", "#F2A07B", "#7FB069", "#4FB5A5", "#3C8DBC", "#C0813B", "#A0522D", "#F3E5C3", "#6B8E23", "#E6B8A2"],
    neutrals: ["#F3E5C3", "#B78B5C", "#7A5230", "#1C2436"],
    avoid: "Cool pastels, icy greys and blue-based pinks.",
  },
  {
    id: "bright-spring", family: "spring", label: "Bright Spring",
    tagline: "Clear, warm and high-contrast",
    description: "Bright eyes and clear skin with noticeable contrast. Saturation is your friend: true red, bright coral, turquoise and clear blue.",
    traits: { undertone: "warm", depth: "medium", clarity: "bright" },
    palette: ["#FF6F61", "#FF8C42", "#FFD23F", "#2EC4B6", "#1E90FF", "#3DDC84", "#FF4F9A", "#FFF4E0", "#2B2B2B", "#E8C170", "#00A6A6", "#F2EDE4"],
    neutrals: ["#FFF4E0", "#B78B5C", "#1C2436", "#2B2B2B"],
    avoid: "Muted, dusty or greyed colours that dull your natural brightness.",
  },
  {
    id: "light-summer", family: "summer", label: "Light Summer",
    tagline: "Cool, light and soft",
    description: "Light hair and eyes with a cool, rosy cast. Powder blue, lavender, soft pink and dove grey sit beautifully against you.",
    traits: { undertone: "cool", depth: "light", clarity: "medium" },
    palette: ["#F4CCE0", "#C9B6E4", "#A7C7E7", "#B5D8CF", "#E8E1D6", "#C8C4BD", "#DDB8A6", "#F2E6EA", "#94A9C9", "#D0E0B0", "#BFAACB", "#8CA3B7"],
    neutrals: ["#E8E1D6", "#B8B5AE", "#6B7078", "#1C2436"],
    avoid: "Black, orange and heavy earth tones.",
  },
  {
    id: "cool-summer", family: "summer", label: "Cool Summer",
    tagline: "Cool, rosy and refined",
    description: "A distinctly cool complexion with medium depth. Raspberry, soft cobalt, slate blue and rose are your signature.",
    traits: { undertone: "cool", depth: "medium", clarity: "medium" },
    palette: ["#B75D77", "#7B8FB5", "#5E7B94", "#A9B7C0", "#D8A7B1", "#906E9E", "#6F8F79", "#E6E6E6", "#4A5A6A", "#B6C2D1", "#9C6B7E", "#2F3B52"],
    neutrals: ["#E6E6E6", "#B8B5AE", "#6B7078", "#1C2436"],
    avoid: "Golden yellows, orange, rust and camel near the face.",
  },
  {
    id: "soft-summer", family: "summer", label: "Soft Summer",
    tagline: "Muted, cool and gentle",
    description: "Blended, low-contrast colouring that leans cool. Muted colours flatter most: mushroom, dusty blue, mauve and sage.",
    traits: { undertone: "cool", depth: "medium", clarity: "soft" },
    palette: ["#A6A2A2", "#8E9AA6", "#B69E93", "#7A8C7E", "#9B7E8C", "#C2B8B0", "#6D7B8D", "#B79BA5", "#57606F", "#D9D2CC", "#8B9C87", "#4E5A60"],
    neutrals: ["#D9D2CC", "#B8B5AE", "#8A8478", "#57606F"],
    avoid: "Neon or highly saturated colours; stark black-and-white.",
  },
  {
    id: "soft-autumn", family: "autumn", label: "Soft Autumn",
    tagline: "Muted, warm and earthy",
    description: "Blended colouring with a gentle warmth. Soft camel, khaki, dusty terracotta and moss echo your natural palette.",
    traits: { undertone: "warm", depth: "medium", clarity: "soft" },
    palette: ["#C6A583", "#A8977C", "#B2836B", "#8F9779", "#C79A85", "#7C8C6E", "#D8C3A5", "#6E6A5C", "#B7A99A", "#9C7B5B", "#5F6E5A", "#E8DFCF"],
    neutrals: ["#E8DFCF", "#D6CCBC", "#B78B5C", "#6E6A5C"],
    avoid: "Icy pastels, pure black and electric brights.",
  },
  {
    id: "warm-autumn", family: "autumn", label: "Warm Autumn",
    tagline: "Rich, golden and warm",
    description: "Golden or olive-warm skin with warm hair and eyes. Rust, mustard, olive and terracotta light you up.",
    traits: { undertone: "warm", depth: "medium", clarity: "medium" },
    palette: ["#B5651D", "#C9A227", "#8B5A2B", "#D2691E", "#6B8E23", "#C57B57", "#A0522D", "#E3B778", "#556B2F", "#A63A2A", "#F0E1C6", "#4E3B2A"],
    neutrals: ["#F0E1C6", "#B78B5C", "#7A5230", "#4E3B2A"],
    avoid: "Cool pinks, blue-greys and pure black.",
  },
  {
    id: "deep-autumn", family: "autumn", label: "Deep Autumn",
    tagline: "Deep, warm and intense",
    description: "Dark hair or eyes with warm-toned skin. You wear depth well: espresso, oxblood, forest, burnt orange and deep teal.",
    traits: { undertone: "warm", depth: "deep", clarity: "medium" },
    palette: ["#4B2E1E", "#7A2E2E", "#8A4B2D", "#2F4A3A", "#C46A2B", "#B8860B", "#5A3A55", "#1E3D4F", "#7B7A4B", "#E9D8B4", "#3B2F2F", "#9E1B32"],
    neutrals: ["#E9D8B4", "#7A5230", "#4A2E21", "#2E1F19"],
    avoid: "Pale pastels and washed-out colours that leave you looking drained.",
  },
  {
    id: "deep-winter", family: "winter", label: "Deep Winter",
    tagline: "Deep, cool and dramatic",
    description: "High contrast with dark hair and eyes, and cool or neutral skin. Black, navy, oxblood, pine and pure white are made for you.",
    traits: { undertone: "cool", depth: "deep", clarity: "medium" },
    palette: ["#111111", "#1E2A44", "#5A1E22", "#2E1A47", "#1F5F5B", "#7A1F3D", "#F7F6F2", "#3A3A3A", "#0F4C81", "#9B111E", "#2C4C3B", "#C0B283"],
    neutrals: ["#F7F6F2", "#3A3A3A", "#1C2436", "#111111"],
    avoid: "Muted earth tones, orange and warm beige near the face.",
  },
  {
    id: "cool-winter", family: "winter", label: "Cool Winter",
    tagline: "Cool, crisp and clear",
    description: "Distinctly cool skin, often with ash or black hair. Icy tones, cobalt, fuchsia, blue-red and true navy are your best.",
    traits: { undertone: "cool", depth: "medium", clarity: "medium" },
    palette: ["#E8E8E8", "#2B4C9B", "#C71585", "#9E2B2B", "#0F52BA", "#6A5ACD", "#1C2436", "#111111", "#F7F6F2", "#708090", "#B0C4DE", "#8B0045"],
    neutrals: ["#F7F6F2", "#708090", "#1C2436", "#111111"],
    avoid: "Warm browns, mustard, orange and camel.",
  },
  {
    id: "bright-winter", family: "winter", label: "Bright Winter",
    tagline: "Clear, cool and vivid",
    description: "Bright eyes and clear skin with striking contrast. You can carry saturation others cannot: hot pink, cobalt, true red and lemon.",
    traits: { undertone: "cool", depth: "medium", clarity: "bright" },
    palette: ["#FF0F80", "#0047AB", "#00A99D", "#E32636", "#FFD700", "#7B2CBF", "#00B7EB", "#111111", "#FFFFFF", "#2ECC71", "#F2F2F2", "#B22222"],
    neutrals: ["#FFFFFF", "#3A3A3A", "#1C2436", "#111111"],
    avoid: "Dusty, muted or greyed colours.",
  },
];

const BY_ID = new Map(SEASONS.map((s) => [s.id, s]));

export function getSeason(id: string | null | undefined): Season | undefined {
  return id ? BY_ID.get(id as SeasonId) : undefined;
}

export function isSeasonId(x: unknown): x is SeasonId {
  return typeof x === "string" && BY_ID.has(x as SeasonId);
}

/**
 * Map the three measured traits to one of twelve seasons.
 * Undertone picks the warm/cool half, depth picks light vs deep families, and the
 * dominant secondary characteristic picks the sub-tone. Neutral undertones fall to
 * the family whose clarity matches best (soft → Summer/Autumn, bright → Spring/Winter).
 */
export function traitsToSeason({ undertone, depth, clarity }: Traits): SeasonId {
  if (undertone === "warm") {
    if (depth === "light") return clarity === "bright" ? "bright-spring" : "light-spring";
    if (depth === "medium") return clarity === "bright" ? "bright-spring" : clarity === "soft" ? "soft-autumn" : "warm-spring";
    return clarity === "soft" ? "warm-autumn" : "deep-autumn";
  }
  if (undertone === "cool") {
    if (depth === "light") return clarity === "bright" ? "bright-winter" : "light-summer";
    if (depth === "medium") return clarity === "bright" ? "bright-winter" : clarity === "soft" ? "soft-summer" : "cool-summer";
    return clarity === "medium" ? "cool-winter" : "deep-winter";
  }
  // neutral
  if (depth === "light") return clarity === "bright" ? "bright-spring" : "light-summer";
  if (depth === "medium") return clarity === "bright" ? "bright-winter" : clarity === "soft" ? "soft-autumn" : "soft-summer";
  return clarity === "bright" ? "deep-winter" : "deep-autumn";
}
