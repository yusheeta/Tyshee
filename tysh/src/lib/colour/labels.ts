import type { SeasonId } from "./seasons";

/** Season display names only: keeps palette data out of client bundles that just need a label. */
export const SEASON_LABELS: Record<SeasonId, string> = {
  "light-spring": "Light Spring",
  "warm-spring": "Warm Spring",
  "bright-spring": "Bright Spring",
  "light-summer": "Light Summer",
  "cool-summer": "Cool Summer",
  "soft-summer": "Soft Summer",
  "soft-autumn": "Soft Autumn",
  "warm-autumn": "Warm Autumn",
  "deep-autumn": "Deep Autumn",
  "deep-winter": "Deep Winter",
  "cool-winter": "Cool Winter",
  "bright-winter": "Bright Winter",
};

export function seasonLabel(id: string | null | undefined): string | undefined {
  return id && id in SEASON_LABELS ? SEASON_LABELS[id as SeasonId] : undefined;
}
