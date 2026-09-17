"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ColourProfile } from "@/lib/colour/profile";
import { getSeason } from "@/lib/colour/seasons";
import { saveColourProfile } from "@/lib/actions/colour-profile";
import { SeasonSwatches } from "./SeasonSwatches";

export function SeasonResult({ profile, onRedo, compact = false }: { profile: ColourProfile; onRedo?: () => void; compact?: boolean }) {
  const season = getSeason(profile.season);
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    // Persist to the account if signed in; silently a no-op for guests.
    saveColourProfile(profile).then((r) => setSaved(r.saved)).catch(() => setSaved(false));
  }, [profile]);

  if (!season) return null;
  return (
    <div>
      <p className="eyebrow">Your season</p>
      <h3 className="display mt-2 text-4xl sm:text-5xl">{season.label}</h3>
      <p className="mt-2 font-serif text-lg italic text-graphite">{season.tagline}</p>
      <SeasonSwatches season={season} tall className="mt-6" />
      <p className="mt-6 text-[15px] leading-relaxed text-graphite">{season.description}</p>
      <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5 text-sm">
        {(["undertone", "depth", "clarity"] as const).map((k) => (
          <div key={k}>
            <dt className="eyebrow">{k}</dt>
            <dd className="mt-1 capitalize">{profile[k]}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-start gap-3 text-sm text-graphite">
        <div className="mt-1 flex shrink-0 gap-1">
          {season.neutrals.map((h) => (
            <span key={h} className="h-4 w-4 rounded-full ring-1 ring-ink/15" style={{ backgroundColor: h }} />
          ))}
        </div>
        <p>
          <span className="text-ink">Your neutrals.</span> Avoid: {season.avoid}
        </p>
      </div>
      {!compact && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href={`/collections/all?season=${season.id}`} className="btn">
            Shop my palette
          </Link>
          {onRedo && (
            <button type="button" onClick={onRedo} className="btn btn-ghost">
              Start again
            </button>
          )}
        </div>
      )}
      <p className="mt-4 text-xs text-stone">
        {saved === true ? "Saved to your account." : "Saved on this device. Sign in to keep it across devices."}
        {" "}Analysed by {profile.method === "photo" ? "photo" : profile.method === "quiz" ? "questionnaire" : "your selection"}.
      </p>
    </div>
  );
}
