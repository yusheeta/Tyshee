"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { seasonLabel } from "@/lib/colour/labels";
import type { MatchResult } from "@/lib/colour/match";
import { useColourProfile } from "@/lib/colour/profile-store";
import { CloseIcon, SparkleIcon } from "@/components/ui/Icons";
import { MatchBadge } from "./MatchBadge";

interface Scored {
  /** Inputs the result was computed for, so a stale result is never shown. */
  key: string;
  result: MatchResult;
  better?: { name: string; score: number };
}

/** Scores on demand so the palette data and CIEDE2000 maths ship only when there is a profile. */
async function computeMatch(hex: string, colourName: string, colourways: { name: string; hex: string }[], seasonId: string, key: string): Promise<Scored | null> {
  const [{ scoreColour }, { getSeason }] = await Promise.all([import("@/lib/colour/match"), import("@/lib/colour/seasons")]);
  const season = getSeason(seasonId);
  if (!season) return null;
  const result = scoreColour(hex, season);
  const better = colourways
    .filter((c) => c.name !== colourName)
    .map((c) => ({ name: c.name, score: scoreColour(c.hex, season).score }))
    .filter((x) => x.score >= result.score + 8)
    .sort((a, b) => b.score - a.score)[0];
  return { key, result, better };
}

// The analysis flow (canvas sampling, quiz) is only loaded when someone opens it.
const ColourAnalysis = dynamic(() => import("./ColourAnalysis").then((m) => m.ColourAnalysis), {
  loading: () => <p className="text-sm text-stone">Loading…</p>,
});

interface Props {
  hex: string;
  colourName: string;
  /** All colourways, so we can point to a better one. */
  colourways: { name: string; hex: string }[];
  onPickColour?: (name: string) => void;
}

/**
 * PDP block: "Does this colour suit me?" With a saved profile it scores the selected
 * colourway and suggests a better-matching one; without, it opens the analysis.
 */
export function ColourMatch({ hex, colourName, colourways, onPickColour }: Props) {
  const profile = useColourProfile((s) => s.profile);
  const hydrated = useColourProfile((s) => s.hydrated);
  const [open, setOpen] = useState(false);
  const [scored, setScored] = useState<Scored | null>(null);
  const key = profile ? `${profile.season}|${hex}|${colourName}` : "";

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    computeMatch(hex, colourName, colourways, profile.season, key).then((r) => {
      if (!cancelled && r) setScored(r);
    });
    return () => {
      cancelled = true;
    };
  }, [hex, colourName, colourways, profile, key]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const label = seasonLabel(profile?.season);
  const current = scored && scored.key === key ? scored : null;
  const result = current?.result ?? null;
  const better = current?.better;

  return (
    <div className="border-t border-line pt-6">
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow flex items-center gap-2 text-ink">
          <SparkleIcon width={14} height={14} /> Colour analysis
        </p>
        {hydrated && profile && label && (
          <button type="button" onClick={() => setOpen(true)} className="eyebrow link-underline text-stone">
            {label} · change
          </button>
        )}
      </div>

      {!hydrated ? (
        <div className="mt-3 h-10" aria-hidden="true" />
      ) : !profile || !label ? (
        <div className="mt-3">
          <p className="text-sm leading-relaxed text-graphite">Find out whether {colourName.toLowerCase()} was made for your colouring. A one-minute analysis, done entirely in your browser.</p>
          <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost mt-4">
            Does this colour suit me?
          </button>
        </div>
      ) : !result ? (
        <div className="mt-3 h-10" aria-hidden="true" />
      ) : (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 shrink-0 rounded-full ring-1 ring-ink/15" style={{ backgroundColor: hex }} aria-hidden="true" />
            <MatchBadge rating={result.rating} label={result.label} score={result.score} className="!bg-transparent !px-0 !text-ink" />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-graphite">{result.reason}</p>
          {better && (
            <p className="mt-2 text-sm text-graphite">
              Better for you in{" "}
              {onPickColour ? (
                <button type="button" onClick={() => onPickColour(better.name)} className="link-underline text-ink">
                  {better.name}
                </button>
              ) : (
                <span className="text-ink">{better.name}</span>
              )}{" "}
              ({better.score}).
            </p>
          )}
          <Link href={`/collections/all?season=${profile.season}`} className="eyebrow link-underline mt-3 inline-block text-ink">
            Shop my palette
          </Link>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Colour analysis" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto bg-paper p-6 sm:p-10">
            <div className="flex items-start justify-between gap-4">
              <p className="font-serif text-2xl tracking-[0.3em]">TYSHEE</p>
              <button type="button" onClick={() => setOpen(false)} className="-mr-2 -mt-2 flex h-10 w-10 items-center justify-center" aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <div className="mt-6">
              <ColourAnalysis onComplete={() => undefined} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
