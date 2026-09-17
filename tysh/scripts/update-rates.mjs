/**
 * Refresh the committed exchange-rate snapshot (src/data/rates.json) from a public feed.
 *   npm run rates:update
 *   RATES_URL=https://api.frankfurter.app/latest?from=USD npm run rates:update
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.RATES_URL || "https://open.er-api.com/v6/latest/USD";
const path = resolve("src/data/rates.json");
const current = JSON.parse(readFileSync(path, "utf8"));
const res = await fetch(url);
if (!res.ok) throw new Error(`${url} → ${res.status}`);
const json = await res.json();
const feed = json.rates ?? json.conversion_rates;
if (!feed) throw new Error("Unexpected response shape; expected { rates: { INR: … } }");
const rates = { ...current.rates };
for (const code of Object.keys(rates)) if (typeof feed[code] === "number") rates[code] = Number(feed[code].toFixed(4));
writeFileSync(path, JSON.stringify({ ...current, asOf: new Date().toISOString().slice(0, 10), source: url, rates }, null, 2) + "\n");
console.log("Updated", path, rates);
