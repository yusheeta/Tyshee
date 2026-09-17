import type { Rating } from "@/lib/colour/match";
import { cn } from "@/lib/utils";

const STYLE: Record<Rating, string> = {
  "made-for-you": "bg-ink text-paper",
  "works-well": "bg-paper text-ink",
  "wear-with-intention": "bg-paper/90 text-graphite",
  "not-your-best": "bg-paper/80 text-stone",
};

export function MatchBadge({ rating, label, score, className }: { rating: Rating; label: string; score?: number; className?: string }) {
  return (
    <span className={cn("eyebrow inline-flex items-center gap-2 px-2.5 py-1.5 !tracking-[0.14em]", STYLE[rating], className)}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
      {typeof score === "number" && <span className="tabular-nums opacity-70">{score}</span>}
    </span>
  );
}
