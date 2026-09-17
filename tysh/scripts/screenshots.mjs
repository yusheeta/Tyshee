/**
 * Capture storefront screenshots for the README, plus the score gauges from the
 * Lighthouse HTML reports in ./lighthouse (when present).
 *   npm run screenshots -- --base=http://localhost:3100
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const BASE = args.base || "http://localhost:3100";
const OUT = resolve("docs/screenshots");
mkdirSync(OUT, { recursive: true });
const chromePath = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].filter(Boolean).find((p) => existsSync(p));

const SHOTS = [
  ["home-desktop", "/", { width: 1440, height: 900 }, true],
  ["collection-desktop", "/collections/women", { width: 1440, height: 900 }, true],
  ["product-desktop", "/products/ines-car-coat", { width: 1440, height: 900 }, false],
  ["colour-analysis-desktop", "/colour-analysis", { width: 1440, height: 900 }, false],
  ["home-mobile", "/", { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true }, false],
  ["product-mobile", "/products/ines-car-coat", { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true }, false],
];

const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ["--no-sandbox", "--no-proxy-server", "--disable-gpu"] });
try {
  for (const [name, path, viewport, fullPage] of SHOTS) {
    const page = await browser.newPage();
    await page.setViewport({ deviceScaleFactor: 1, ...viewport });
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage, type: "png" });
    console.log(`✓ ${name}`);
    await page.close();
  }

  // Lighthouse gauges: open each HTML report and crop the score strip.
  const lhDir = resolve("lighthouse");
  if (existsSync(lhDir)) {
    for (const file of readdirSync(lhDir).filter((f) => f.endsWith(".report.html"))) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1100, height: 700, deviceScaleFactor: 2 });
      await page.goto(`file://${resolve(lhDir, file)}`, { waitUntil: "load" });
      const strip = await page.$(".lh-scores-header");
      if (strip) {
        await strip.screenshot({ path: resolve(OUT, `lighthouse-${file.replace(".report.html", "")}.png`), type: "png" });
        console.log(`✓ lighthouse-${file.replace(".report.html", "")}`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
