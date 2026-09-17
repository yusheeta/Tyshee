"use client";

import { useMoney } from "@/lib/currency-store";
import { cn } from "@/lib/utils";

/**
 * Displays a USD-cent catalogue amount in the visitor's currency. Server HTML renders the
 * base currency; the client store swaps in the detected or chosen currency on hydration.
 */
export function Price({ amount, compareAt, className }: { amount: number; compareAt?: number; className?: string }) {
  const { format } = useMoney();
  return (
    <span className={cn("tabular-nums text-sm text-graphite", className)} suppressHydrationWarning>
      {compareAt && compareAt > amount ? (
        <>
          <span className="text-oxblood">{format(amount)}</span> <s className="text-stone">{format(compareAt)}</s>
        </>
      ) : (
        format(amount)
      )}
    </span>
  );
}
