/**
 * Lighthouse lab run.
 *
 *   npm run lighthouse              # build with the mock image origin, start, audit, report
 *   npm run lighthouse -- --skip-build
 *   npm run lighthouse -- --origin=https://images.unsplash.com   # real CDN, where reachable
 *
 * Audits the storefront's four page types on mobile and desktop and writes HTML/JSON
 * reports plus a Markdown summary to ./lighthouse. Chrome is launched with
 * --no-proxy-server and --no-sandbox so it works inside CI containers.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const PORT = Number(args.port || 3100);
const MOCK_PORT = 4010;
const ORIGIN = args.origin || `http://127.0.0.1:${MOCK_PORT}`;
const useMock = ORIGIN.includes(`127.0.0.1:${MOCK_PORT}`);
const OUT = resolve("lighthouse");
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["home", "/"],
  ["collection", "/collections/women"],
  ["product", "/products/ines-car-coat"],
  ["journal", "/journal/the-weight-of-a-good-coat"],
];

const CHROME_CANDIDATES = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].filter(Boolean);
const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));

function run(cmd, argv, env = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, argv, { stdio: "inherit", env: { ...process.env, ...env }, shell: process.platform === "win32" });
    p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))));
  });
}

async function waitFor(url, ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const children = [];
const cleanup = () => children.forEach((c) => c.kill("SIGTERM"));
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(1));

try {
  if (!args["skip-build"]) {
    console.log(`\n▶ next build (NEXT_PUBLIC_IMAGE_ORIGIN=${ORIGIN})`);
    await run("npx", ["next", "build"], { NEXT_PUBLIC_IMAGE_ORIGIN: ORIGIN, NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` });
  }

  if (useMock) {
    const mock = spawn(process.execPath, ["scripts/mock-image-origin.mjs"], { stdio: "inherit", env: { ...process.env, PORT: String(MOCK_PORT) } });
    children.push(mock);
    await waitFor(`http://127.0.0.1:${MOCK_PORT}/health`);
  }

  const app = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
  children.push(app);
  await waitFor(`http://localhost:${PORT}/`);
  // Warm the pages once so the measurement reflects steady-state serving (ISR caches populated),
  // and warm every image variant they reference so the mock origin behaves like a CDN edge
  // with a hot cache rather than a cold renderer. Lighthouse's Lantern model anchors its
  // estimate on the *observed* LCP timestamp, so a slow first-render origin would skew the
  // score in a way a real CDN never would.
  for (const [, path] of PAGES) {
    const html = await (await fetch(`http://localhost:${PORT}${path}`)).text();
    if (!useMock) continue;
    const urls = new Set([...html.matchAll(/http:\/\/127\.0\.0\.1:4010\/[^"'\s,)]+/g)].map((m) => m[0].replace(/&amp;/g, "&")));
    let warmed = 0;
    const list = [...urls];
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (list.length) {
        const u = list.shift();
        await fetch(u, { headers: { accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" } }).catch(() => {});
        warmed++;
      }
    }));
    console.log(`  warmed ${warmed} image variants for ${path}`);
  }

  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-proxy-server", "--no-first-run"],
  });

  const rows = [];
  for (const formFactor of ["mobile", "desktop"]) {
    for (const [name, path] of PAGES) {
      const url = `http://localhost:${PORT}${path}`;
      const flags = { port: chrome.port, output: ["html", "json"], logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] };
      const config = formFactor === "desktop"
        ? { extends: "lighthouse:default", settings: { formFactor: "desktop", screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 } } }
        : { extends: "lighthouse:default" };
      process.stdout.write(`▶ ${formFactor.padEnd(7)} ${path.padEnd(40)}`);
      const result = await lighthouse(url, flags, config);
      const lhr = result.lhr;
      const cat = (k) => Math.round((lhr.categories[k]?.score ?? 0) * 100);
      const aud = (k) => lhr.audits[k]?.numericValue ?? 0;
      const row = {
        page: name, path, formFactor,
        performance: cat("performance"), accessibility: cat("accessibility"), bestPractices: cat("best-practices"), seo: cat("seo"),
        fcp: aud("first-contentful-paint"), lcp: aud("largest-contentful-paint"), tbt: aud("total-blocking-time"), cls: aud("cumulative-layout-shift"), si: aud("speed-index"),
        transfer: lhr.audits["total-byte-weight"]?.numericValue ?? 0,
        imageBytes: (lhr.audits["network-requests"]?.details?.items ?? []).filter((i) => (i.mimeType || "").startsWith("image/")).reduce((s, i) => s + (i.transferSize || 0), 0),
      };
      rows.push(row);
      console.log(` perf ${row.performance}  a11y ${row.accessibility}  bp ${row.bestPractices}  seo ${row.seo}  LCP ${(row.lcp / 1000).toFixed(2)}s  CLS ${row.cls.toFixed(3)}`);
      writeFileSync(resolve(OUT, `${name}-${formFactor}.report.html`), result.report[0]);
      writeFileSync(resolve(OUT, `${name}-${formFactor}.report.json`), result.report[1]);
    }
  }
  await chrome.kill();

  const kb = (b) => `${Math.round(b / 1024)} KB`;
  const md = [
    `# Lighthouse results`,
    ``,
    `Generated ${new Date().toISOString()} · Lighthouse ${rows.length ? JSON.parse((await import("node:fs")).readFileSync(resolve(OUT, `${PAGES[0][0]}-mobile.report.json`), "utf8")).lighthouseVersion : ""} · image origin: \`${ORIGIN}\`${useMock ? " (local imgix-compatible mock; see docs/PERFORMANCE.md)" : ""}`,
    ``,
    `| Page | Device | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS | Speed Index | Page weight | Image bytes |`,
    `|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|`,
    ...rows.map((r) => `| ${r.page} \`${r.path}\` | ${r.formFactor} | **${r.performance}** | ${r.accessibility} | ${r.bestPractices} | ${r.seo} | ${(r.fcp / 1000).toFixed(2)}s | ${(r.lcp / 1000).toFixed(2)}s | ${Math.round(r.tbt)}ms | ${r.cls.toFixed(3)} | ${(r.si / 1000).toFixed(2)}s | ${kb(r.transfer)} | ${kb(r.imageBytes)} |`),
    ``,
    `Mobile uses Lighthouse's default simulated Moto G Power / slow 4G profile. Desktop uses the standard desktop preset.`,
    `Full HTML reports sit next to this file.`,
    ``,
  ].join("\n");
  writeFileSync(resolve(OUT, "SUMMARY.md"), md);
  writeFileSync(resolve(OUT, "summary.json"), JSON.stringify(rows, null, 2));
  console.log(`\nWrote ${rows.length} reports + SUMMARY.md to ${OUT}`);
} finally {
  cleanup();
}
process.exit(0);
