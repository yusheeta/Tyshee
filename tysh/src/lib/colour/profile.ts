import type { Clarity, Depth, SeasonId, Undertone } from "./seasons";

export type AnalysisMethod = "photo" | "quiz" | "manual";

export interface ColourProfile {
  season: SeasonId;
  undertone: Undertone;
  depth: Depth;
  clarity: Clarity;
  method: AnalysisMethod;
  /** Sampled skin colour when the photo method was used. */
  skinHex?: string;
  updatedAt: string;
}

export const PROFILE_COOKIE = "tysh_season";
