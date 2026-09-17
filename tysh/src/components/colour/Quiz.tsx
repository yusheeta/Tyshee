"use client";

import { QUIZ } from "@/lib/colour/skin";
import { cn } from "@/lib/utils";

interface Props {
  answers: Record<string, number>;
  onChange: (answers: Record<string, number>) => void;
  /** Only render these question ids (used to ask clarity after a photo reading). */
  only?: string[];
}

export function Quiz({ answers, onChange, only }: Props) {
  const questions = only ? QUIZ.filter((q) => only.includes(q.id)) : QUIZ;
  return (
    <ol className="space-y-8">
      {questions.map((q, qi) => (
        <li key={q.id}>
          <p className="font-serif text-xl leading-snug">
            {!only && <span className="mr-2 text-stone">{qi + 1}.</span>}
            {q.prompt}
          </p>
          {q.help && <p className="mt-1 text-xs text-stone">{q.help}</p>}
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={q.prompt}>
            {q.options.map((o, oi) => {
              const selected = answers[q.id] === oi;
              return (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange({ ...answers, [q.id]: oi })}
                  className={cn(
                    "border px-4 py-2.5 text-left text-sm transition",
                    selected ? "border-ink bg-ink text-paper" : "border-line bg-paper text-graphite hover:border-ink",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}
