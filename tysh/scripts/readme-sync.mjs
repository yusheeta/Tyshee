/**
 * Inject the latest Lighthouse summary table and screenshot gallery into README.md.
 *   node scripts/readme-sync.mjs
 * Idempotent: replaces the content between the <!-- LIGHTHOUSE --> / <!-- SCREENSHOTS --> markers.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const readme = resolve("README.md");
let md = readFileSync(readme, "utf8");

function replaceBlock(src, marker, body) {
  const start = `<!-- ${marker} -->`;
  const end = `<!-- /${marker} -->`;
  const block = `${start}\n${body.trim()}\n${end}`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}|${start}`);
  return re.test(src) ? src.replace(re, block) : src;
}

// Lighthouse table
const summaryPath = resolve("lighthouse/summary.json");
if (existsSync(summaryPath)) {
  const rows = JSON.parse(readFileSync(summaryPath, "utf8"));
  const kb = (b) => `${Math.round(b / 1024)} KB`;
  const table = [
    "| Page | Device | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS | Page weight |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((r) => `| ${r.page} \`${r.path}\` | ${r.formFactor} | **${r.performance}** | ${r.accessibility} | ${r.bestPractices} | ${r.seo} | ${(r.lcp / 1000).toFixed(2)}s | ${Math.round(r.tbt)}ms | ${r.cls.toFixed(3)} | ${kb(r.transfer)} |`),
  ].join("\n");
  const gauges = readdirSync(resolve("docs/screenshots")).filter((f) => f.startsWith("lighthouse-") && f.endsWith(".png")).sort();
  const gaugeMd = gauges.length
    ? `\n\n${gauges.filter((f) => /home-mobile|product-mobile|collection-mobile/.test(f)).map((f) => `<img src="docs/screenshots/${f}" alt="${f.replace("lighthouse-", "Lighthouse scores, ").replace(".png", "").replace("-", " ")}" width="420" />`).join("\n")}`
    : "";
  md = replaceBlock(md, "LIGHTHOUSE", `Lighthouse 13, mobile = simulated Moto G Power on slow 4G, desktop = standard preset. Reports in [\`lighthouse/\`](lighthouse/).\n\n${table}${gaugeMd}`);
}

// Screenshot gallery
const shotsDir = resolve("docs/screenshots");
if (existsSync(shotsDir)) {
  const shots = readdirSync(shotsDir).filter((f) => /\.(png|jpg)$/.test(f) && !f.startsWith("lighthouse-"));
  const pick = (name) => shots.find((f) => f.startsWith(name));
  const items = [
    ["home-desktop", "Home"],
    ["collection-desktop", "Collection with filters"],
    ["product-desktop", "Product page with colour analysis"],
    ["colour-analysis-desktop", "Personal colour analysis"],
  ].filter(([n]) => pick(n));
  if (items.length) {
    const body =
      `<table><tr>${items.slice(0, 2).map(([n, t]) => `<td width="50%"><img src="docs/screenshots/${pick(n)}" alt="${t}" /><br/><sub>${t}</sub></td>`).join("")}</tr>` +
      `<tr>${items.slice(2, 4).map(([n, t]) => `<td width="50%"><img src="docs/screenshots/${pick(n)}" alt="${t}" /><br/><sub>${t}</sub></td>`).join("")}</tr></table>\n\n` +
      `<sub>Screenshots captured against the local imgix-compatible mock origin (synthetic photographs). On a normal network the same slots show Unsplash editorial photography.</sub>`;
    md = replaceBlock(md, "SCREENSHOTS", body);
  }
}

writeFileSync(readme, md);
console.log("README synced");
