import assert from "node:assert/strict";
import { describe, it } from "node:test";
import products from "../src/data/products.json";
import { COLLECTIONS, collectionForProduct, collectionTrail, getCollection } from "../src/data/collections";
import { CATEGORIES, JEWELLERY_CATEGORIES, RTW_BY_DEPARTMENT, SHOES_BY_DEPARTMENT } from "../src/data/taxonomy";
import type { Product } from "../src/lib/types";

const all = products as Product[];
const list = (slug: string) => all.filter(getCollection(slug)!.match);

describe("catalogue integrity", () => {
  it("has 200 products, each in a known category with a brand label", () => {
    assert.equal(all.length, 200);
    for (const p of all) {
      assert.ok(p.category in CATEGORIES, `${p.slug}: unknown category ${p.category}`);
      assert.equal(p.brand, "TYSHEE");
      assert.ok(p.images.length >= 2);
    }
  });

  it("women's collections contain only women's products, men's only men's", () => {
    for (const c of COLLECTIONS.filter((c) => c.slug === "women" || c.slug.startsWith("women-"))) {
      const items = all.filter(c.match);
      assert.ok(items.length > 0, `${c.slug} is empty`);
      assert.ok(items.every((p) => p.department === "women"), `${c.slug} contains non-women products`);
    }
    for (const c of COLLECTIONS.filter((c) => c.slug === "men" || c.slug.startsWith("men-"))) {
      const items = all.filter(c.match);
      assert.ok(items.length > 0, `${c.slug} is empty`);
      assert.ok(items.every((p) => p.department === "men"), `${c.slug} contains non-men products`);
    }
  });

  it("women's and men's photography never share a photo id", () => {
    const women = new Set(all.filter((p) => p.department === "women").flatMap((p) => p.images.map((i) => i.id)));
    const men = all.filter((p) => p.department === "men").flatMap((p) => p.images.map((i) => i.id));
    const shared = men.filter((id) => women.has(id));
    assert.deepEqual(shared, [], `shared photos: ${shared.join(", ")}`);
  });

  it("category pages contain exactly their category", () => {
    for (const c of COLLECTIONS.filter((c) => c.parent && !c.children)) {
      const items = all.filter(c.match);
      const cats = new Set(items.map((p) => p.category));
      assert.equal(cats.size, 1, `${c.slug} mixes categories: ${[...cats].join(", ")}`);
    }
    // A shirt is never a dress, a blouse is never a top.
    assert.ok(list("women-dresses").every((p) => /Dress|Gown/.test(p.name)));
    assert.ok(list("women-shirts").every((p) => /Shirt/.test(p.name) && !/Dress/.test(p.name)));
    assert.ok(list("women-blouses").every((p) => /Blouse/.test(p.name)));
    assert.ok(list("women-skirts").every((p) => /Skirt/.test(p.name)));
    assert.ok(list("women-jeans").every((p) => /Jean/.test(p.name)));
    assert.ok(list("women-sarees").every((p) => /Saree/.test(p.name)));
    assert.ok(list("women-coats").every((p) => /Coat|Trench|Peacoat/.test(p.name)));
    assert.ok(list("women-jackets").every((p) => /Jacket/.test(p.name)));
  });

  it("every department category and shoe category has products", () => {
    for (const d of ["women", "men"] as const) {
      for (const c of RTW_BY_DEPARTMENT[d]) assert.ok(list(`${d}-${c}`).length > 0, `${d}-${c} empty`);
      for (const c of SHOES_BY_DEPARTMENT[d]) assert.ok(list(`${d}-${c}`).length > 0, `${d}-${c} empty`);
    }
    assert.ok(list("women-heels").every((p) => /Pump|Mule|Court/.test(p.name)));
    assert.ok(list("women-ballerinas").every((p) => /Ballet|Ballerina/.test(p.name)));
    assert.ok(list("men-boat-shoes").every((p) => /Boat|Deck/.test(p.name)));
  });

  it("jewellery is split into its subcategories with nothing left over", () => {
    const jewellery = list("jewellery");
    const inSubs = JEWELLERY_CATEGORIES.flatMap((c) => list(c));
    assert.equal(jewellery.length, inSubs.length);
    for (const c of JEWELLERY_CATEGORIES) assert.ok(list(c).length > 0, `${c} empty`);
    assert.ok(list("rings").every((p) => /Ring/.test(p.name)));
    assert.ok(list("earrings").every((p) => /Earring/.test(p.name)));
    assert.ok(list("necklaces").every((p) => /Necklace/.test(p.name)));
    assert.ok(list("bangles").every((p) => /Bangle/.test(p.name)));
  });

  it("files products under department-specific collections with a breadcrumb trail", () => {
    const dress = all.find((p) => p.category === "dresses")!;
    assert.equal(collectionForProduct(dress), "women-dresses");
    assert.deepEqual(collectionTrail("women-dresses").map((c) => c.slug), ["women", "women-dresses"]);
    assert.deepEqual(collectionTrail("women-heels").map((c) => c.slug), ["women", "women-shoes", "women-heels"]);
    const ring = all.find((p) => p.category === "rings")!;
    assert.equal(collectionForProduct(ring), "rings");
    assert.deepEqual(collectionTrail("rings").map((c) => c.slug), ["jewellery", "rings"]);
  });
});
