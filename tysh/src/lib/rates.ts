import "server-only";
import { CURRENCY_CODES, STATIC_RATES, STATIC_RATES_AS_OF, type CurrencyCode, type Rates } from "./currency";

export interface RatesResult {
  rates: Rates;
  asOf: string;
  source: "live" | "static";
}

/**
 * Server-side rate lookup. When RATES_URL is configured (any endpoint returning
 * `{ rates: { INR: 84.6, … } }` relative to USD, e.g. https://open.er-api.com/v6/latest/USD)
 * it is fetched and cached for twelve hours; otherwise, or on any failure, the committed
 * snapshot is used. The client fetches the same result from /api/rates, so product pages,
 * the bag and the charge all agree.
 */
export async function getRates(): Promise<RatesResult> {
  const url = process.env.RATES_URL;
  if (url) {
    try {
      const res = await fetch(url, { next: { revalidate: 60 * 60 * 12 } });
      if (res.ok) {
        const json = (await res.json()) as { rates?: Record<string, number>; time_last_update_utc?: string };
        if (json.rates) {
          const rates = { ...STATIC_RATES };
          for (const code of CURRENCY_CODES) {
            const v = json.rates[code];
            if (typeof v === "number" && v > 0) rates[code as CurrencyCode] = v;
          }
          return { rates, asOf: json.time_last_update_utc ?? new Date().toISOString(), source: "live" };
        }
      }
    } catch (e) {
      console.warn("[rates] live fetch failed, using snapshot", e instanceof Error ? e.message : e);
    }
  }
  return { rates: STATIC_RATES, asOf: STATIC_RATES_AS_OF, source: "static" };
}
