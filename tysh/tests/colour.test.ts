import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deltaE2000, hexToLab, hexToLch, hexToRgb, rgbToHex } from "../src/lib/colour/convert";
import { bestMatch, scoreColour } from "../src/lib/colour/match";
import { getSeason, SEASONS, traitsToSeason } from "../src/lib/colour/seasons";
import { analyseSkinPixels, depthFromIta, ita, quizToTraits, undertoneFromHue } from "../src/lib/colour/skin";

describe("colour conversions", () => {
  it("round-trips hex ↔ rgb", () => {
    assert.deepEqual(hexToRgb("#B78B5C"), [183, 139, 92]);
    assert.equal(rgbToHex([183, 139, 92]), "#b78b5c");
    assert.deepEqual(hexToRgb("#fff"), [255, 255, 255]);
  });

  it("matches CIELAB reference values", () => {
    const white = hexToLab("#ffffff");
    assert.ok(Math.abs(white.L - 100) < 0.01 && Math.abs(white.a) < 0.01 && Math.abs(white.b) < 0.01);
    const red = hexToLab("#ff0000");
    assert.ok(Math.abs(red.L - 53.24) < 0.1, `L ${red.L}`);
    assert.ok(Math.abs(red.a - 80.09) < 0.2, `a ${red.a}`);
    assert.ok(Math.abs(red.b - 67.2) < 0.2, `b ${red.b}`);
  });

  it("implements CIEDE2000 (Sharma et al. test pairs)", () => {
    const pairs: [number[], number[], number][] = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[50, 2.5, 0], [50, 3.2592, 0.335], 1.0],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    ];
    for (const [a, b, expected] of pairs) {
      const d = deltaE2000({ L: a[0], a: a[1], b: a[2] }, { L: b[0], a: b[1], b: b[2] });
      assert.ok(Math.abs(d - expected) < 0.001, `expected ${expected}, got ${d}`);
    }
  });
});

describe("skin analysis", () => {
  it("classifies depth from ITA°", () => {
    assert.equal(depthFromIta(60), "light");
    assert.equal(depthFromIta(30), "medium");
    assert.equal(depthFromIta(5), "deep");
    // A light, yellowish skin tone has a high ITA
    assert.ok(ita(hexToLab("#F1D2B6")) > 41);
    // A deep skin tone has a low ITA
    assert.ok(ita(hexToLab("#5C3A21")) < 19);
  });

  it("reads undertone from hue angle", () => {
    assert.equal(undertoneFromHue(70), "warm");
    assert.equal(undertoneFromHue(40), "cool");
    assert.equal(undertoneFromHue(55), "neutral");
    assert.equal(hexToLch("#E8B98A").h > 60, true); // golden
  });

  it("aggregates skin pixels robustly and rejects non-skin", () => {
    const warmSkin = Array.from({ length: 200 }, (_, i) => [230 - (i % 7), 185 - (i % 5), 150 - (i % 9)] as [number, number, number]);
    const reading = analyseSkinPixels(warmSkin);
    assert.ok(reading);
    assert.equal(reading.undertone, "warm");
    assert.equal(reading.depth, "light");
    assert.ok(reading.sampleSize >= 150);
    // Pure blue background yields nothing usable
    assert.equal(analyseSkinPixels(Array.from({ length: 50 }, () => [20, 40, 220] as [number, number, number])), null);
  });

  it("maps quiz answers to traits with weighted votes", () => {
    const t = quizToTraits({ veins: 1, metal: 1, sun: 2, white: 0, depth: 2, contrast: 0 });
    assert.deepEqual(t, { undertone: "cool", depth: "deep", clarity: "bright" });
  });
});

describe("seasons", () => {
  it("defines twelve seasons with 12-swatch palettes", () => {
    assert.equal(SEASONS.length, 12);
    for (const s of SEASONS) {
      assert.equal(s.palette.length, 12, s.id);
      assert.ok(s.neutrals.length >= 3, s.id);
      for (const hex of [...s.palette, ...s.neutrals]) assert.match(hex, /^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("maps traits deterministically", () => {
    assert.equal(traitsToSeason({ undertone: "cool", depth: "deep", clarity: "bright" }), "deep-winter");
    assert.equal(traitsToSeason({ undertone: "warm", depth: "light", clarity: "soft" }), "light-spring");
    assert.equal(traitsToSeason({ undertone: "warm", depth: "deep", clarity: "medium" }), "deep-autumn");
    assert.equal(traitsToSeason({ undertone: "cool", depth: "medium", clarity: "soft" }), "soft-summer");
    assert.equal(traitsToSeason({ undertone: "neutral", depth: "medium", clarity: "bright" }), "bright-winter");
  });
});

describe("garment matching", () => {
  const winter = getSeason("deep-winter")!;
  const spring = getSeason("light-spring")!;
  const autumn = getSeason("warm-autumn")!;

  it("scores within 0–100 and ranks intuitively", () => {
    const blackWinter = scoreColour("#111111", winter);
    const blackSpring = scoreColour("#111111", spring);
    assert.ok(blackWinter.score >= 0 && blackWinter.score <= 100);
    assert.ok(blackWinter.score > blackSpring.score, `black: winter ${blackWinter.score} vs spring ${blackSpring.score}`);
    assert.equal(blackWinter.rating, "made-for-you");

    const camelAutumn = scoreColour("#B78B5C", autumn);
    const camelWinter = scoreColour("#B78B5C", winter);
    assert.ok(camelAutumn.score > camelWinter.score, `camel: autumn ${camelAutumn.score} vs winter ${camelWinter.score}`);

    const peachSpring = scoreColour("#F4C2A1", spring);
    assert.ok(peachSpring.score >= 62, `peach for light spring ${peachSpring.score}`);
  });

  it("explains the verdict and picks the best colourway", () => {
    const r = scoreColour("#D89B3B", winter);
    assert.ok(r.reason.length > 20);
    const best = bestMatch([{ name: "Saffron", hex: "#D89B3B" }, { name: "Black", hex: "#111111" }], winter);
    assert.equal(best.colourway.name, "Black");
  });
});
