/**
 * Audit every catalogue photograph against Unsplash's own metadata.
 *
 *   npm run images:audit            # report only
 *   npm run images:audit -- --write # also write src/data/image-exclusions.json
 *
 * For each unique photo id the script fetches the photo's description, alt text and tags
 * and checks them against the department and category the photo is used for: a women's
 * listing must not carry a photo tagged man/men/male, a dress must not be illustrated by a
 * photo tagged coat or shirt, and so on. Dead ids (404) are reported too. With --write the
 * mismatches are saved to image-exclusions.json, which the generator honours; then run
 * `npm run catalog` to rebuild the catalogue without them.
 *
 * Uses the official API when UNSPLASH_ACCESS_KEY is set, otherwise the public web endpoint.
 * Run on a network where unsplash.com is reachable.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const write = process.argv.includes("--write");
const KEY = process.env.UNSPLASH_ACCESS_KEY;
const products = JSON.parse(readFileSync(resolve("src/data/products.json"), "utf8"));

// What each category's photograph should and should not be about.
const FORBID_BY_DEPARTMENT = {
  women: ["man", "men", "male", "guy", "gentleman", "beard", "menswear", "boy"],
  men: ["woman", "women", "female", "girl", "lady", "dress", "skirt", "heels", "bride"],
  unisex: [],
};
const EXPECT_BY_CATEGORY = {
  coats: ["coat", "trench", "overcoat", "outerwear", "jacket"],
  jackets: ["jacket", "blazer", "bomber", "leather"],
  tailoring: ["blazer", "suit", "jacket", "tailor"],
  knitwear: ["sweater", "knit", "cardigan", "wool", "cashmere", "jumper"],
  dresses: ["dress", "gown"],
  tops: ["top", "shirt", "t-shirt", "tee", "camisole", "tank"],
  blouses: ["blouse", "shirt", "top", "silk"],
  shirts: ["shirt", "blouse"],
  skirts: ["skirt"],
  trousers: ["trousers", "pants", "trouser"],
  jeans: ["jeans", "denim"],
  sarees: ["saree", "sari", "indian", "ethnic", "traditional"],
  heels: ["heels", "heel", "pump", "stiletto", "shoe"],
  flats: ["loafer", "flat", "shoe", "oxford", "derby"],
  ballerinas: ["ballet", "flat", "shoe"],
  sandals: ["sandal", "shoe", "feet"],
  boots: ["boot", "shoe"],
  "boat-shoes": ["boat", "deck", "shoe", "loafer", "sneaker"],
  bags: ["bag", "handbag", "tote", "purse", "leather"],
  "small-leather-goods": ["wallet", "card", "leather", "purse"],
  belts: ["belt", "leather"],
  necklaces: ["necklace", "jewelry", "jewellery", "pearl", "chain"],
  earrings: ["earring", "jewelry", "jewellery"],
  rings: ["ring", "jewelry", "jewellery"],
  bracelets: ["bracelet", "jewelry", "jewellery", "cuff"],
  bangles: ["bangle", "bracelet", "jewelry", "jewellery"],
  anklets: ["anklet", "chain", "jewelry", "jewellery", "ankle"],
  pendants: ["pendant", "necklace", "jewelry", "jewellery"],
  chains: ["chain", "necklace", "jewelry", "jewellery", "gold"],
  brooches: ["brooch", "pin", "jewelry", "jewellery"],
  "jewellery-sets": ["jewelry", "jewellery", "pearl", "necklace"],
  watches: ["watch", "wrist"],
  eyewear: ["sunglasses", "glasses", "eyewear"],
  fragrance: ["perfume", "fragrance", "bottle", "scent"],
  objects: ["candle", "throw", "blanket", "home", "interior"],
};

const uses = new Map(); // id → [{slug, department, category}]
for (const p of products) for (const im of p.images) {
  if (!uses.has(im.id)) uses.set(im.id, []);
  uses.get(im.id).push({ slug: p.slug, department: p.department, category: p.category });
}

async function fetchMeta(id) {
  const bare = id.replace(/^photo-/, "");
  const url = KEY ? `https://api.unsplash.com/photos/${bare}` : `https://unsplash.com/napi/photos/${bare}`;
  const res = await fetch(url, { headers: KEY ? { Authorization: `Client-ID ${KEY}` } : { accept: "application/json" } });
  if (res.status === 404) return { missing: true };
  if (!res.ok) return { error: res.status };
  const j = await res.json();
  const text = [j.description, j.alt_description, ...(j.tags ?? []).map((t) => t.title)].filter(Boolean).join(" · ").toLowerCase();
  return { text, width: j.width, height: j.height };
}

const ids = [...uses.keys()];
console.log(`Auditing ${ids.length} photographs${KEY ? " via the official API" : ""} …`);
const findings = [];
let done = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (ids.length) {
    const id = ids.shift();
    const meta = await fetchMeta(id).catch((e) => ({ error: e.message }));
    done++;
    if (meta.missing) { findings.push({ id, reason: "404 not found", uses: uses.get(id) }); continue; }
    if (meta.error) { findings.push({ id, reason: `fetch error ${meta.error}`, uses: uses.get(id), soft: true }); continue; }
    for (const u of uses.get(id)) {
      const forbid = FORBID_BY_DEPARTMENT[u.department].find((w) => new RegExp(`\\b${w}\\b`).test(meta.text));
      if (forbid) { findings.push({ id, reason: `tagged "${forbid}" but used for ${u.department} (${u.slug})`, uses: [u] }); break; }
      const expect = EXPECT_BY_CATEGORY[u.category] ?? [];
      if (expect.length && !expect.some((w) => meta.text.includes(w))) {
        findings.push({ id, reason: `no ${u.category} keyword in Unsplash tags (${u.slug}); tags: ${meta.text.slice(0, 90)}`, uses: [u], soft: true });
        break;
      }
    }
    if (done % 25 === 0) process.stdout.write(`  ${done} checked\n`);
  }
}));

const hard = findings.filter((f) => !f.soft);
const soft = findings.filter((f) => f.soft);
for (const f of hard) console.log(`  ✗ ${f.id}  ${f.reason}`);
for (const f of soft) console.log(`  ? ${f.id}  ${f.reason}`);
console.log(`\n${hard.length} hard mismatches (wrong gender / dead id), ${soft.length} soft (category keyword not found).`);

if (write) {
  const path = resolve("src/data/image-exclusions.json");
  const current = JSON.parse(readFileSync(path, "utf8"));
  const exclude = [...new Set([...current.exclude, ...hard.map((f) => f.id), ...soft.filter((f) => !/fetch error/.test(f.reason)).map((f) => f.id)])].sort();
  writeFileSync(path, JSON.stringify({ exclude }, null, 2) + "\n");
  console.log(`Wrote ${exclude.length} excluded ids → ${path}. Now run: npm run catalog`);
}
process.exit(hard.length ? 1 : 0);
