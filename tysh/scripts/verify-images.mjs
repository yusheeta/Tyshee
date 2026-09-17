/**
 * Verify every Unsplash photo id referenced by the catalogue, collections and journal.
 *
 *   npm run images:verify
 *
 * Sends a HEAD request per unique id (tiny 32px variant) with limited concurrency and
 * prints any id that does not resolve. Exit code 1 if anything is broken, so it can run
 * in CI. Run this where images.unsplash.com is reachable.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ORIGIN = process.env.IMAGE_ORIGIN || "https://images.unsplash.com";
const CONCURRENCY = 8;

const products = JSON.parse(readFileSync(resolve("src/data/products.json"), "utf8"));
const ids = new Set(products.flatMap((p) => p.images.map((i) => i.id)));
for (const f of ["src/data/collections.ts", "src/data/journal.ts", "src/data/hero.json", "src/app/about/page.tsx", "src/app/colour-analysis/page.tsx"]) {
  const src = readFileSync(resolve(f), "utf8");
  for (const m of src.matchAll(/photo-[0-9]+-[0-9a-f]+/g)) ids.add(m[0]);
}

const list = [...ids];
console.log(`Checking ${list.length} unique photos against ${ORIGIN} …`);
const broken = [];
let done = 0;

async function check(id) {
  const url = `${ORIGIN}/${id}?w=32&q=10&auto=format`;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (!res.ok) broken.push({ id, status: res.status });
  } catch (e) {
    broken.push({ id, status: e.code || e.message });
  } finally {
    done++;
    if (done % 25 === 0) process.stdout.write(`  ${done}/${list.length}\n`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (list.length) await check(list.shift());
}));

if (broken.length) {
  console.log(`\n${broken.length} broken photo id(s):`);
  for (const b of broken) console.log(`  ${b.id}  (${b.status})`);
  console.log("\nReplace these ids in scripts/generate-catalog.ts (IMG pools) or the data files, then run `npm run catalog`.");
  process.exit(1);
}
console.log("All photos resolve.");
