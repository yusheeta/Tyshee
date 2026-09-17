"use client";

import { CURRENCIES, CURRENCY_CODES, isCurrencyCode } from "@/lib/currency";
import { setCurrency, useCurrencyState } from "@/lib/currency-store";
import { cn } from "@/lib/utils";

/**
 * Manual currency choice. Selecting a currency writes a sticky cookie so it is used on
 * every page and at checkout, and geo-detection never overrides it again.
 */
export function CurrencySelector({ className, labelled = false }: { className?: string; labelled?: boolean }) {
  const { currency, mode } = useCurrencyState();
  return (
    <label className={cn("relative inline-flex items-center gap-2", className)} title={mode === "auto" ? "Detected from your location. Change it any time." : "Your selected currency"}>
      {labelled ? <span className="eyebrow">Currency</span> : <span className="sr-only">Currency</span>}
      <select
        value={currency}
        onChange={(e) => isCurrencyCode(e.target.value) && setCurrency(e.target.value)}
        className="eyebrow h-10 cursor-pointer appearance-none bg-transparent pr-3.5 text-ink outline-none"
      >
        {CURRENCY_CODES.map((code) => (
          <option key={code} value={code}>
            {CURRENCIES[code].symbol === code ? code : `${code} ${CURRENCIES[code].symbol}`}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[9px] text-ink">▾</span>
    </label>
  );
}
