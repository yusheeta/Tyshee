"use client";

import { useSyncExternalStore } from "react";
import {
  BASE_CURRENCY,
  CURRENCY_COOKIE,
  CURRENCY_MODE_COOKIE,
  convertMinor,
  formatMoney,
  isCurrencyCode,
  STATIC_RATES,
  type CurrencyCode,
  type CurrencyMode,
  type Rates,
} from "./currency";

interface CurrencyState {
  currency: CurrencyCode;
  mode: CurrencyMode;
  rates: Rates;
  ratesSource: "static" | "live";
}

const SERVER_STATE: CurrencyState = { currency: BASE_CURRENCY, mode: "auto", rates: STATIC_RATES, ratesSource: "static" };

let state: CurrencyState | null = null;
const listeners = new Set<() => void>();
let ratesRequested = false;

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** Initialise from the cookie the proxy (or a previous manual choice) set. */
function getSnapshot(): CurrencyState {
  if (!state) {
    const c = readCookie(CURRENCY_COOKIE);
    const m = readCookie(CURRENCY_MODE_COOKIE);
    state = {
      currency: isCurrencyCode(c) ? c : BASE_CURRENCY,
      mode: m === "manual" ? "manual" : "auto",
      rates: STATIC_RATES,
      ratesSource: "static",
    };
    void refreshRates();
  }
  return state;
}

function getServerSnapshot(): CurrencyState {
  return SERVER_STATE;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(next: Partial<CurrencyState>) {
  state = { ...getSnapshot(), ...next };
  listeners.forEach((l) => l());
}

/** Pull the server's current rate table once per page load so the client matches the charge. */
export async function refreshRates(): Promise<void> {
  if (ratesRequested || typeof window === "undefined") return;
  ratesRequested = true;
  try {
    const res = await fetch("/api/rates", { cache: "force-cache" });
    if (!res.ok) return;
    const json = (await res.json()) as { rates: Rates; source: "static" | "live" };
    if (json?.rates) emit({ rates: json.rates, ratesSource: json.source });
  } catch {
    // keep the snapshot
  }
}

/** A manual choice is sticky: the proxy never overrides it with geo detection again. */
export function setCurrency(code: CurrencyCode) {
  writeCookie(CURRENCY_COOKIE, code);
  writeCookie(CURRENCY_MODE_COOKIE, "manual");
  emit({ currency: code, mode: "manual" });
}

export function useCurrencyState(): CurrencyState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Convert-and-format helpers bound to the visitor's currency. */
export function useMoney() {
  const { currency, rates } = useCurrencyState();
  return {
    currency,
    rates,
    /** Minor units of the visitor's currency for a USD-cent catalogue amount. */
    convert: (usdCents: number) => convertMinor(usdCents, currency, rates),
    /** Formatted string for a USD-cent catalogue amount. */
    format: (usdCents: number) => formatMoney(convertMinor(usdCents, currency, rates), currency),
    /** Formatted string for an amount already in the visitor's currency. */
    formatLocal: (minor: number) => formatMoney(minor, currency),
  };
}
