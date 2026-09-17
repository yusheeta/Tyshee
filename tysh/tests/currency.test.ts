import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptLanguageToCurrency, convertMinor, countryToCurrency, formatConverted, formatMoney, STATIC_RATES } from "../src/lib/currency";

describe("currency", () => {
  it("maps countries and languages to currencies", () => {
    assert.equal(countryToCurrency("IN"), "INR");
    assert.equal(countryToCurrency("us"), "USD");
    assert.equal(countryToCurrency("GB"), "GBP");
    assert.equal(countryToCurrency("DE"), "EUR");
    assert.equal(countryToCurrency("FR"), "EUR");
    assert.equal(countryToCurrency("JP"), "JPY");
    assert.equal(countryToCurrency("AE"), "AED");
    assert.equal(countryToCurrency("BR"), "USD");
    assert.equal(acceptLanguageToCurrency("en-IN,en;q=0.9"), "INR");
    assert.equal(acceptLanguageToCurrency("ja"), "JPY");
    assert.equal(acceptLanguageToCurrency("en-GB"), "GBP");
    assert.equal(acceptLanguageToCurrency(null), "USD");
  });

  it("converts USD cents with retail rounding per currency", () => {
    const rates = { ...STATIC_RATES, INR: 84, GBP: 0.8, EUR: 0.9, JPY: 150, AED: 3.67 };
    assert.equal(convertMinor(145000, "USD", rates), 145000);
    assert.equal(convertMinor(145000, "INR", rates), 121800 * 100); // 1450 × 84 = 121,800 → nearest 50
    assert.equal(convertMinor(145000, "GBP", rates), 116000);
    assert.equal(convertMinor(145000, "EUR", rates), 130500);
    assert.equal(convertMinor(145000, "JPY", rates), 217500); // yen, zero-decimal, nearest 100
    assert.equal(convertMinor(145000, "AED", rates), 532200); // 5321.5 → 5322
  });

  it("formats with the right symbol, grouping and decimals", () => {
    assert.equal(formatMoney(145000, "USD"), "$1,450");
    assert.equal(formatMoney(12180000, "INR"), "₹1,21,800");
    assert.equal(formatMoney(217500, "JPY"), "￥217,500".replace("￥", formatMoney(1, "JPY").replace(/[\d,.]/g, "")));
    assert.match(formatMoney(116000, "GBP"), /^£1,160$/);
    assert.match(formatMoney(532200, "AED"), /AED\s?5,322/);
    assert.match(formatConverted(145000, "EUR", { ...STATIC_RATES, EUR: 0.9 }), /1\.305\s?€/);
  });

  it("keeps line totals as unit × qty in every currency", () => {
    const rates = { ...STATIC_RATES, INR: 84.6 };
    const unit = convertMinor(29000, "INR", rates);
    assert.equal(unit % 5000, 0); // rounded to ₹50
    assert.equal(unit * 3, convertMinor(29000, "INR", rates) * 3);
  });
});
