import ratesSnapshot from "@/data/rates.json";

/**
 * Money model. Catalogue prices are stored once, in USD cents (the base currency).
 * Every display converts from that base with a rate table, rounds to a sensible retail
 * step for the target currency, and formats with the right locale, symbol and decimals.
 * Orders are charged and stored in the currency the visitor checked out in, alongside
 * the rate used and the USD total, so reporting can always be reconciled.
 */
export type CurrencyCode = "USD" | "INR" | "GBP" | "EUR" | "JPY" | "AED";

export const BASE_CURRENCY: CurrencyCode = "USD";
export const CURRENCY_CODES: CurrencyCode[] = ["USD", "INR", "GBP", "EUR", "JPY", "AED"];

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  label: string;
  /** Locale used for grouping and symbol placement (e.g. en-IN gives 1,20,500). */
  locale: string;
  /** Minor units per major unit: 100 for cents/paise, 1 for zero-decimal currencies. */
  minorUnits: 100 | 1;
  /** Retail rounding step in major units after conversion. */
  roundTo: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  USD: { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US", minorUnits: 100, roundTo: 1 },
  INR: { code: "INR", symbol: "₹", label: "Indian Rupee", locale: "en-IN", minorUnits: 100, roundTo: 50 },
  GBP: { code: "GBP", symbol: "£", label: "British Pound", locale: "en-GB", minorUnits: 100, roundTo: 1 },
  EUR: { code: "EUR", symbol: "€", label: "Euro", locale: "de-DE", minorUnits: 100, roundTo: 1 },
  JPY: { code: "JPY", symbol: "¥", label: "Japanese Yen", locale: "ja-JP", minorUnits: 1, roundTo: 100 },
  AED: { code: "AED", symbol: "AED", label: "UAE Dirham", locale: "en-AE", minorUnits: 100, roundTo: 1 },
};

/** Units of each currency per 1 USD. */
export type Rates = Record<CurrencyCode, number>;

export const STATIC_RATES: Rates = ratesSnapshot.rates as Rates;
export const STATIC_RATES_AS_OF: string = ratesSnapshot.asOf;

export function isCurrencyCode(x: unknown): x is CurrencyCode {
  return typeof x === "string" && (CURRENCY_CODES as string[]).includes(x);
}

/**
 * Convert a USD-cent amount into minor units of `to`, rounded to that currency's retail
 * step. Conversion happens on the unit price so a line total is always unit × qty in
 * every currency, and totals never drift from what the product page showed.
 */
export function convertMinor(usdCents: number, to: CurrencyCode, rates: Rates = STATIC_RATES): number {
  if (to === BASE_CURRENCY) return usdCents;
  const meta = CURRENCIES[to];
  const rate = rates[to] ?? STATIC_RATES[to];
  const major = (usdCents / 100) * rate;
  const rounded = Math.round(major / meta.roundTo) * meta.roundTo;
  return Math.round(rounded * meta.minorUnits);
}

/** Format an amount already expressed in `code` minor units. */
export function formatMoney(minor: number, code: CurrencyCode, opts: { compact?: boolean } = {}): string {
  const meta = CURRENCIES[code];
  const major = minor / meta.minorUnits;
  const whole = Number.isInteger(major) || opts.compact;
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: code,
    currencyDisplay: code === "AED" ? "code" : "symbol",
    minimumFractionDigits: whole ? 0 : Math.log10(meta.minorUnits),
    maximumFractionDigits: meta.minorUnits === 1 ? 0 : 2,
  }).format(major);
}

/** Convert-and-format in one step for USD-cent catalogue prices. */
export function formatConverted(usdCents: number, to: CurrencyCode, rates: Rates = STATIC_RATES): string {
  return formatMoney(convertMinor(usdCents, to, rates), to);
}

/** Legacy helper: base-currency formatting. */
export function formatPrice(cents: number): string {
  return formatMoney(cents, BASE_CURRENCY);
}

// ------------------------------------------------------------ Detection ----
const EURO_ZONE = new Set(["DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "FI", "GR", "LU", "SI", "SK", "EE", "LV", "LT", "CY", "MT", "HR"]);

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  JP: "JPY",
  AE: "AED",
};

export function countryToCurrency(country: string | null | undefined): CurrencyCode {
  const cc = (country ?? "").trim().toUpperCase();
  if (!cc) return BASE_CURRENCY;
  if (COUNTRY_TO_CURRENCY[cc]) return COUNTRY_TO_CURRENCY[cc];
  if (EURO_ZONE.has(cc)) return "EUR";
  return BASE_CURRENCY;
}

/** Best-effort fallback when no geo header is present: region subtag of Accept-Language. */
export function acceptLanguageToCurrency(header: string | null | undefined): CurrencyCode {
  if (!header) return BASE_CURRENCY;
  const first = header.split(",")[0]?.trim().split(";")[0] ?? "";
  const [lang, region] = first.split(/[-_]/);
  if (region) return countryToCurrency(region);
  const byLanguage: Record<string, CurrencyCode> = { ja: "JPY", hi: "INR", de: "EUR", fr: "EUR", it: "EUR", es: "EUR", nl: "EUR", pt: "EUR", ar: "AED" };
  return byLanguage[lang?.toLowerCase() ?? ""] ?? BASE_CURRENCY;
}

export const CURRENCY_COOKIE = "tysh_currency";
export const CURRENCY_MODE_COOKIE = "tysh_currency_mode";
export type CurrencyMode = "auto" | "manual";
