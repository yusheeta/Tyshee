"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useColourProfile } from "@/lib/colour/profile-store";
import { seasonLabel } from "@/lib/colour/labels";
import { SparkleIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

/** PLP control: toggles the `season` query param using the saved profile. */
export function PaletteToggle() {
  const profile = useColourProfile((s) => s.profile);
  const hydrated = useColourProfile((s) => s.hydrated);
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("season");

  if (!hydrated) return <span className="inline-block h-9 w-40" aria-hidden="true" />;
  const label = seasonLabel(profile?.season);
  if (!label || !profile) {
    return (
      <Link href="/colour-analysis" className="eyebrow inline-flex h-9 items-center gap-2 text-stone hover:text-ink">
        <SparkleIcon width={14} height={14} /> Find my colour season
      </Link>
    );
  }
  const next = new URLSearchParams(params.toString());
  if (active) next.delete("season");
  else next.set("season", profile.season);
  next.delete("page");
  return (
    <Link href={`${pathname}?${next.toString()}`} className={cn("eyebrow inline-flex h-9 items-center gap-2 border px-3 transition", active ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink")} aria-current={active ? "true" : undefined}>
      <SparkleIcon width={14} height={14} /> {active ? `Sorted for ${label}` : `Sort for my palette · ${label}`}
    </Link>
  );
}
