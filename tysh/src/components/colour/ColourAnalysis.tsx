"use client";

import { useState } from "react";
import type { ColourProfile } from "@/lib/colour/profile";
import { useColourProfile } from "@/lib/colour/profile-store";
import { SEASONS, traitsToSeason, type SeasonId } from "@/lib/colour/seasons";
import { quizToTraits, type SkinReading } from "@/lib/colour/skin";
import { PhotoSampler } from "./PhotoSampler";
import { Quiz } from "./Quiz";
import { SeasonResult } from "./SeasonResult";
import { SeasonSwatches } from "./SeasonSwatches";
import { cn } from "@/lib/utils";

type Method = "photo" | "quiz" | "manual";
type Step = "method" | "capture" | "result";

/**
 * The full analysis flow. Used inline on /colour-analysis and inside the PDP dialog.
 * Photo → skin reading → one clarity question → season.  Quiz → six questions → season.
 * Manual → pick a season you already know.
 */
export function ColourAnalysis({ onComplete, className }: { onComplete?: (p: ColourProfile) => void; className?: string }) {
  const profile = useColourProfile((s) => s.profile);
  const setProfile = useColourProfile((s) => s.setProfile);
  const [method, setMethod] = useState<Method | null>(null);
  const [step, setStep] = useState<Step>(profile ? "result" : "method");
  const [reading, setReading] = useState<SkinReading | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [manual, setManual] = useState<SeasonId | null>(null);

  const reset = () => {
    setMethod(null);
    setReading(null);
    setAnswers({});
    setManual(null);
    setStep("method");
  };

  const finish = (p: ColourProfile) => {
    setProfile(p);
    setStep("result");
    onComplete?.(p);
  };

  const completePhoto = () => {
    if (!reading) return;
    const clarity = quizToTraits(answers).clarity;
    const traits = { undertone: reading.undertone, depth: reading.depth, clarity };
    finish({ ...traits, season: traitsToSeason(traits), method: "photo", skinHex: reading.hex, updatedAt: new Date().toISOString() });
  };

  const completeQuiz = () => {
    const traits = quizToTraits(answers);
    finish({ ...traits, season: traitsToSeason(traits), method: "quiz", updatedAt: new Date().toISOString() });
  };

  const completeManual = () => {
    const s = SEASONS.find((x) => x.id === manual);
    if (!s) return;
    finish({ ...s.traits, season: s.id, method: "manual", updatedAt: new Date().toISOString() });
  };

  if (step === "result" && profile) {
    return (
      <div className={className}>
        <SeasonResult profile={profile} onRedo={reset} />
      </div>
    );
  }

  if (step === "method") {
    return (
      <div className={className}>
        <p className="eyebrow">Step 1 of 2</p>
        <h3 className="display mt-2 text-3xl sm:text-4xl">How would you like to be analysed?</h3>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["photo", "From a photo", "Sample your skin tone in the browser. Most accurate in daylight. Nothing is uploaded."],
              ["quiz", "Six questions", "Veins, metals, sun and contrast. About a minute."],
              ["manual", "I know my season", "Choose one of the twelve seasons directly."],
            ] as const
          ).map(([m, t, d]) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMethod(m);
                setStep("capture");
              }}
              className="border border-line p-5 text-left transition hover:border-ink"
            >
              <span className="font-serif text-xl">{t}</span>
              <span className="mt-2 block text-xs leading-relaxed text-stone">{d}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // capture
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Step 2 of 2</p>
        <button type="button" onClick={reset} className="eyebrow link-underline text-ink">
          Back
        </button>
      </div>

      {method === "photo" && (
        <div className="mt-4">
          <PhotoSampler onReading={setReading} />
          {reading && (
            <div className="mt-8 border-t border-line pt-6">
              <Quiz answers={answers} onChange={setAnswers} only={["contrast"]} />
              <button type="button" onClick={completePhoto} disabled={answers.contrast === undefined} className="btn mt-8">
                Reveal my season
              </button>
            </div>
          )}
        </div>
      )}

      {method === "quiz" && (
        <div className="mt-6">
          <Quiz answers={answers} onChange={setAnswers} />
          <button type="button" onClick={completeQuiz} disabled={Object.keys(answers).length < 6} className="btn mt-10">
            Reveal my season
          </button>
        </div>
      )}

      {method === "manual" && (
        <div className="mt-6">
          <div className="grid gap-2 sm:grid-cols-2">
            {SEASONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setManual(s.id)}
                aria-pressed={manual === s.id}
                className={cn("border p-3 text-left transition", manual === s.id ? "border-ink" : "border-line hover:border-stone")}
              >
                <SeasonSwatches season={s} className="h-5" />
                <span className="mt-2 block text-sm">{s.label}</span>
                <span className="block text-xs text-stone">{s.tagline}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={completeManual} disabled={!manual} className="btn mt-8">
            Save my season
          </button>
        </div>
      )}
    </div>
  );
}
