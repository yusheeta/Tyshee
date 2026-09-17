/**
 * imgix-compatible mock image origin for lab measurements.
 *
 * Unsplash is not reachable from every CI/sandbox network, so the Lighthouse run
 * points NEXT_PUBLIC_IMAGE_ORIGIN at this server instead. It honours the same query
 * parameters the real CDN does (w, h, q, fit, auto=format) and returns a synthetic
 * "photograph" of the requested size: a soft editorial gradient with film grain so
 * the encoded byte size is in the same range as a real q=75 JPEG/WebP photograph.
 *
 *   node scripts/mock-image-origin.mjs            # listens on :4010
 *   PORT=5000 node scripts/mock-image-origin.mjs
 */
import http from "node:http";
import sharp from "sharp";

const PORT = Number(process.env.PORT || 4010);
const GRAIN = Number(process.env.GRAIN || 20);
const cache = new Map();
// Film grain is expensive to synthesise per request; render one tile up front and repeat it.
// sharp requires a composite input no larger than the base image, so small variants get a crop.
const TILE = 512;
const grainTile = await sharp({ create: { width: TILE, height: TILE, channels: 3, noise: { type: "gaussian", mean: 128, sigma: GRAIN } } }).png().toBuffer();
const grainCache = new Map();
async function grainFor(w, h) {
  const tw = Math.min(w, TILE);
  const th = Math.min(h, TILE);
  if (tw === TILE && th === TILE) return grainTile;
  const key = `${tw}x${th}`;
  let buf = grainCache.get(key);
  if (!buf) {
    buf = await sharp(grainTile).extract({ left: 0, top: 0, width: tw, height: th }).png().toBuffer();
    grainCache.set(key, buf);
  }
  return buf;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function palette(seed) {
  const hues = [28, 35, 40, 200, 210, 350, 20, 45, 160];
  const h = hues[seed % hues.length];
  const s1 = 18 + (seed % 20);
  const l1 = 62 + (seed % 20);
  const l2 = 28 + ((seed >> 3) % 20);
  return [`hsl(${h} ${s1}% ${l1}%)`, `hsl(${(h + 15) % 360} ${s1 + 8}% ${l2}%)`, `hsl(${(h + 300) % 360} ${s1}% ${l1 - 12}%)`];
}

async function render(id, w, h, q, webp) {
  const seed = hash(id);
  const [c1, c2, c3] = palette(seed);
  const cx = 30 + (seed % 40);
  const cy = 25 + ((seed >> 2) % 30);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
      <radialGradient id="r" cx="${cx}%" cy="${cy}%" r="55%"><stop offset="0" stop-color="${c3}" stop-opacity="0.75"/><stop offset="1" stop-color="${c3}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <rect width="${w}" height="${h}" fill="url(#r)"/>
    <ellipse cx="${w * (0.35 + (seed % 30) / 100)}" cy="${h * 0.62}" rx="${w * 0.28}" ry="${h * 0.34}" fill="${c2}" opacity="0.35"/>
  </svg>`;
  const base = sharp(Buffer.from(svg)).resize(w, h);
  const composed = base.composite([{ input: await grainFor(w, h), blend: "soft-light", tile: true }]);
  return webp ? composed.webp({ quality: q }).toBuffer() : composed.jpeg({ quality: q, mozjpeg: true }).toBuffer();
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }
    const id = url.pathname.slice(1) || "photo";
    const w = Math.min(4000, Math.max(16, Number(url.searchParams.get("w") || 800)));
    const ar = 3 / 4;
    const h = Math.min(4000, Math.max(16, Number(url.searchParams.get("h") || Math.round(w / ar))));
    const q = Math.min(100, Math.max(20, Number(url.searchParams.get("q") || 75)));
    const accept = req.headers.accept || "";
    const webp = url.searchParams.get("auto") === "format" && accept.includes("image/webp");
    const key = `${id}|${w}|${h}|${q}|${webp}`;
    let buf = cache.get(key);
    if (!buf) {
      buf = await render(id, w, h, q, webp);
      cache.set(key, buf);
    }
    res.writeHead(200, {
      "content-type": webp ? "image/webp" : "image/jpeg",
      "content-length": buf.length,
      "cache-control": "public, max-age=31536000, immutable",
      "access-control-allow-origin": "*",
      "timing-allow-origin": "*",
      vary: "Accept",
    });
    res.end(buf);
  } catch (e) {
    console.error(e);
    res.writeHead(500).end("error");
  }
});

server.listen(PORT, () => console.log(`mock image origin listening on http://127.0.0.1:${PORT}`));
