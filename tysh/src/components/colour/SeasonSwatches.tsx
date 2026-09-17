import type { Season } from "@/lib/colour/seasons";
import { cn } from "@/lib/utils";

export function SeasonSwatches({ season, className, tall = false }: { season: Season; className?: string; tall?: boolean }) {
  return (
    <div className={cn("flex overflow-hidden", tall ? "h-16" : "h-8", className)} aria-label={`${season.label} palette`} role="img">
      {season.palette.map((hex) => (
        <span key={hex} className="flex-1" style={{ backgroundColor: hex }} />
      ))}
    </div>
  );
}
