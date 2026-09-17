/**
 * End-to-end smoke test against a running storefront (test gateway mode).
 *   node scripts/e2e-smoke.mjs --base=http://localhost:3100
 *
 * register → colour quiz → PDP colour match → add to bag → checkout → pay (4242) →
 * success → account shows order + season. Exits non-zero on the first failure.
 */
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const BASE = args.base || "http://localhost:3100";
const chromePath = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].filter(Boolean).find((p) => existsSync(p));
const email = `e2e-${Date.now()}@example.com`;

const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ["--no-sandbox", "--no-proxy-server", "--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
// The flow under test does not depend on photography; abort third-party image requests so
// the run is fast and independent of CDN reachability (e.g. in CI sandboxes).
await page.setRequestInterception(true);
page.on("request", (req) => {
  const url = req.url();
  const local = url.startsWith(BASE) || /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url);
  if (req.resourceType() === "image" && !local) return req.abort();
  return req.continue();
});
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
const step = (s) => console.log(`▶ ${s}`);
const assert = (c, m) => { if (!c) throw new Error(`Assertion failed: ${m}`); };
// textContent, not innerText: eyebrow labels are CSS-uppercased and innerText reflects that.
const text = async () => page.evaluate(() => document.body.textContent || "");
const waitText = async (t, ms = 15000) => {
  try {
    await page.waitForFunction((t) => (document.body.textContent || "").includes(t), { timeout: ms }, t);
  } catch (e) {
    throw new Error(`Timed out waiting for text "${t}" on ${page.url()}: ${e.message}`);
  }
};

try {
  step("register");
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle0" });
  await page.type("#name", "E2E Tester");
  await page.type("#email", email);
  await page.type("#password", "correct-horse-battery");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click('button[type="submit"]')]);
  assert(page.url().endsWith("/account"), `expected /account, got ${page.url()}`);
  assert((await text()).includes("Good to see you, E2E"), "account greeting");

  step("colour analysis quiz");
  await page.goto(`${BASE}/colour-analysis`, { waitUntil: "networkidle0" });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Six questions")).click());
  await waitText("Step 2 of 2");
  // answer: cool, silver, burns+stays pink, crisp white, deep, strongly contrasting → deep/bright winter
  const picks = ["Blue or purple", "Silver", "Burns and stays pink", "Crisp and flattering", "Deep: dark brown", "Strongly contrasting"];
  for (const p of picks) await page.evaluate((p) => [...document.querySelectorAll('button[role="radio"]')].find((b) => b.textContent.includes(p)).click(), p);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Reveal my season")).click());
  await waitText("Your season");
  const seasonText = await text();
  assert(/Winter/.test(seasonText), "expected a Winter season");
  await waitText("Saved to your account", 10000);
  const cookie = (await page.cookies()).find((c) => c.name === "tysh_season");
  assert(cookie && cookie.value.includes("winter"), "season cookie set");

  step("women's category pages contain only women's products; currency switch converts prices");
  await page.goto(`${BASE}/collections/women-dresses`, { waitUntil: "networkidle0" });
  const dressCards = await page.$$eval("article h2", (els) => els.map((e) => e.textContent));
  assert(dressCards.length > 0 && dressCards.every((t) => /Dress|Gown/.test(t)), `women-dresses shows non-dresses: ${dressCards.join(", ")}`);
  assert((await text()).includes("TYSHEE"), "brand label on cards");
  const usdPrice = await page.$eval("article .tabular-nums", (e) => e.textContent);
  assert(usdPrice.startsWith("$"), `expected USD default in the sandbox, got ${usdPrice}`);
  await page.select("header select", "INR");
  await page.waitForFunction(() => /₹/.test(document.querySelector("article .tabular-nums").textContent), { timeout: 5000 });
  const inrPrice = await page.$eval("article .tabular-nums", (e) => e.textContent);
  assert(inrPrice.startsWith("₹"), `expected INR after selecting it, got ${inrPrice}`);
  const usd = Number(usdPrice.replace(/[^0-9.]/g, ""));
  const inr = Number(inrPrice.replace(/[^0-9.]/g, ""));
  assert(inr > usd * 60 && inr < usd * 110, `INR amount ${inr} is not a plausible conversion of $${usd}`);
  const currencyCookie = (await page.cookies()).find((c) => c.name === "tysh_currency");
  assert(currencyCookie?.value === "INR", "currency cookie persisted");
  await page.goto(`${BASE}/collections/men-flats`, { waitUntil: "networkidle0" });
  assert((await page.$eval("article .tabular-nums", (e) => e.textContent)).startsWith("₹"), "currency sticks across pages");
  const menCrumb = await text();
  assert(menCrumb.includes("Men") && !/Women/.test(await page.$eval("h1", (e) => e.textContent)), "men flats page");

  step("card: double-click cycles colours, swatch selects, wishlist saves");
  await page.goto(`${BASE}/collections/women-dresses`, { waitUntil: "networkidle0" });
  const multi = await page.$$eval("article", (els) => els.map((e, i) => ({ i, n: e.querySelectorAll('[role="radio"]').length, colours: [...e.querySelectorAll('[role="radio"]')].map((r) => r.getAttribute("aria-label")), variant: e.dataset.variant })).filter((x) => x.n >= 3)[0]);
  assert(multi, "a card with 3+ colours exists");
  const card = (await page.$$("article"))[multi.i];
  // Keep the card clear of the sticky header so clicks land on the card, not the nav.
  await card.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
  const readVariant = () => card.evaluate((e) => e.dataset.variant);
  const imgSrc = () => card.$eval("img", (e) => e.getAttribute("src"));
  assert((await readVariant()) === multi.colours[0], "starts on first colour");
  const src0 = await imgSrc();
  const img = await card.$('[role="link"]');
  // Two real clicks in quick succession (a CDP clickCount:2 press emits only one click event).
  const doubleClick = async () => { await img.click(); await img.click(); await new Promise((r) => setTimeout(r, 380)); };
  await doubleClick();
  assert((await readVariant()) === multi.colours[1], `1st double-click → ${multi.colours[1]}, got ${await readVariant()}`);
  assert((await imgSrc()) !== src0, "image changed with colour");
  await doubleClick();
  assert((await readVariant()) === multi.colours[2], "2nd double-click → third colour");
  for (let k = 2; k < multi.n; k++) await doubleClick();
  assert((await readVariant()) === multi.colours[0], "cycles back to the first colour");
  assert(page.url().includes("/collections/women-dresses"), "double-clicks did not navigate");
  await (await card.$$('[role="radio"]'))[1].click();
  assert((await readVariant()) === multi.colours[1], "swatch tap selects a colour");
  const heart = await card.$('button[aria-label^="Save"]');
  await heart.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
  await heart.click();
  await waitText("Saved to your wishlist");
  await page.waitForFunction(() => /\(1\)/.test(document.querySelector('header a[href="/wishlist"]')?.textContent || ""), { timeout: 5000 });

  step("PDP colour match + add to bag");
  await page.goto(`${BASE}/products/ines-car-coat`, { waitUntil: "networkidle0" });
  await waitText("Colour analysis");
  await page.waitForFunction(() => /Made for you|Works well|Wear with intention|Not your best/.test(document.body.textContent || ""), { timeout: 10000 });
  const pdpColours = await page.$$eval('[aria-label="Colour"] button', (els) => els.map((b) => b.getAttribute("aria-label")));
  const chosenColour = pdpColours.find((c) => !/sold out/.test(c)) ?? pdpColours[0];
  const chosenIdx = pdpColours.indexOf(chosenColour);
  // Pick the last in-stock colour to prove the cart records the *selected* variant.
  const lastIn = pdpColours.map((c, i) => [c, i]).filter(([c]) => !/sold out/.test(c)).pop();
  const pickColour = lastIn ? lastIn[0] : chosenColour;
  await (await page.$$('[aria-label="Colour"] button'))[lastIn ? lastIn[1] : chosenIdx].click();
  await page.waitForFunction((c) => document.body.textContent.includes(c), { timeout: 3000 }, pickColour);
  const sizeBtn = (await page.$$('[aria-label="Size"] button:not([disabled])'))[0];
  const pickedSize = await sizeBtn.evaluate((e) => e.textContent.trim());
  await sizeBtn.click();
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Add to bag")).click());
  await waitText("Added to bag");
  await page.waitForFunction(() => /\(1\)/.test(document.querySelector('header a[href="/cart"]')?.textContent || ""), { timeout: 5000 });

  step("palette-sorted PLP shows badges");
  await page.goto(`${BASE}/collections/women?season=${cookie.value}`, { waitUntil: "networkidle0" });
  assert((await text()).includes("Made for you"), "PLP badge");

  step("cart → checkout");
  await page.goto(`${BASE}/cart`, { waitUntil: "networkidle0" });
  await waitText("Ines Car Coat");
  const cartText = await text();
  assert(cartText.includes(`${pickColour} · Size ${pickedSize}`), `cart shows selected variant ${pickColour}/${pickedSize}`);

  step("theme switch applies data-theme");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").startsWith("Appearance")).click());
  await page.evaluate(() => [...document.querySelectorAll('[role="menuitemradio"]')].find((b) => b.textContent.includes("Night")).click());
  assert((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "night", "night theme applied");
  await page.reload({ waitUntil: "networkidle0" });
  assert((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "night", "theme persists across reload");
  await page.evaluate(() => { localStorage.removeItem("tysh-theme"); document.documentElement.removeAttribute("data-theme"); });
  await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle0" });
  await waitText("Shipping address");
  assert((await page.$eval("#email", (e) => e.value)) === email, "email prefilled from session");
  await page.type("#name", "E2E Tester");
  await page.type("#line1", "1 Quiet Street");
  await page.type("#city", "Copenhagen");
  await page.type("#postalCode", "1050");
  await page.select("#country", "DK");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click('button[type="submit"]')]);
  assert(page.url().includes("/checkout/pay/ord_"), `expected test gateway, got ${page.url()}`);
  assert(/₹/.test(await text()), "test gateway shows the order in INR");

  step("declined card, then approved card");
  await page.$eval("#number", (e) => (e.value = ""));
  await page.type("#number", "4000 0000 0000 0002");
  await page.type("#name", "E2E Tester");
  await page.click('button[type="submit"]');
  await waitText("declined");
  assert((await page.$eval("#name", (e) => e.value)) === "E2E Tester", "typed values survive a declined attempt");
  await page.$eval("#number", (e) => (e.value = ""));
  await page.type("#number", "4242 4242 4242 4242");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click('button[type="submit"]')]);
  assert(page.url().includes("/checkout/success?order=ord_"), `expected success, got ${page.url()}`);
  await waitText("Thank you.");
  await page.waitForFunction(() => !/\(\d+\)/.test(document.querySelector('header a[href="/cart"]')?.textContent || ""), { timeout: 5000 });

  step("account shows order and season");
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
  const acct = await text();
  assert(acct.includes("ord_") && /\bpaid\b/i.test(acct), "order listed as paid");
  assert(/Winter/.test(acct), "season saved to account");
  await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent.includes("ord_")).click());
  await page.waitForNavigation({ waitUntil: "networkidle0" });
  await waitText("Ines Car Coat");

  step("sign out → protected redirect");
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Sign out")).click())]);
  await page.goto(`${BASE}/account/orders`, { waitUntil: "networkidle0" });
  assert(page.url().includes("/login?next="), "redirected to login");

  console.log("\n✓ E2E smoke passed");
} catch (e) {
  console.error("\n✗ E2E failed:", e.message);
  await page.screenshot({ path: "e2e-failure.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
