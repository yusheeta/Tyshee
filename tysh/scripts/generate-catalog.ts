/**
 * Deterministic catalogue generator for TYSHEE.
 *
 *   npm run catalog
 *
 * Produces src/data/products.json — 200 products, each in exactly one category of the
 * taxonomy (src/data/taxonomy.ts) with a department, colourways, sizes, copy and 2–3
 * Unsplash photographs drawn from a pool specific to that category and department, so
 * women's listings only ever show women's photography and a dress is never illustrated
 * with a coat. Photo ids listed in src/data/image-exclusions.json (written by
 * `npm run images:audit`) are never used.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { BRAND, type CategorySlug, type Department } from "../src/data/taxonomy";
import type { Colourway, CropStrategy, Product, Variant } from "../src/lib/types";

// ---------------------------------------------------------------- PRNG ----
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260917);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const chance = (p: number) => rand() < p;
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
function mixHex(a: string, b: string, t: number): string {
  const pa = a.replace("#", "").match(/../g)!.map((x) => parseInt(x, 16));
  const pb = b.replace("#", "").match(/../g)!.map((x) => parseInt(x, 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

// ------------------------------------------------------------- Palette ----
const C = {
  ivory: { name: "Ivory", hex: "#F2EDE4" }, bone: { name: "Bone", hex: "#E9E2D6" }, oat: { name: "Oat", hex: "#D6CCBC" },
  sand: { name: "Sand", hex: "#D8D1C4" }, stone: { name: "Stone", hex: "#8A8478" }, camel: { name: "Camel", hex: "#B78B5C" },
  tobacco: { name: "Tobacco", hex: "#7A5230" }, cognac: { name: "Cognac", hex: "#8A4B2D" }, chocolate: { name: "Chocolate", hex: "#4A2E21" },
  espresso: { name: "Espresso", hex: "#2E1F19" }, black: { name: "Black", hex: "#111111" }, charcoal: { name: "Charcoal", hex: "#3A3A3A" },
  slate: { name: "Slate", hex: "#6B7078" }, dove: { name: "Dove Grey", hex: "#B8B5AE" }, navy: { name: "Navy", hex: "#1C2436" },
  ink: { name: "Ink", hex: "#232A3B" }, forest: { name: "Forest", hex: "#2F4A3A" }, moss: { name: "Moss", hex: "#6A7357" },
  olive: { name: "Olive", hex: "#7B7A4B" }, sage: { name: "Sage", hex: "#A7AE95" }, oxblood: { name: "Oxblood", hex: "#5A1E22" },
  claret: { name: "Claret", hex: "#7A2530" }, terracotta: { name: "Terracotta", hex: "#B7663F" }, saffron: { name: "Saffron", hex: "#D89B3B" },
  butter: { name: "Butter", hex: "#EFD79A" }, blush: { name: "Blush", hex: "#E7C2B6" }, rose: { name: "Rose", hex: "#C98A93" },
  lavender: { name: "Lavender", hex: "#B6A6C9" }, powder: { name: "Powder Blue", hex: "#B7C5D6" }, cobalt: { name: "Cobalt", hex: "#2B4C9B" },
  emerald: { name: "Emerald", hex: "#1E6B4E" }, white: { name: "Optic White", hex: "#F7F6F2" }, smoke: { name: "Smoke", hex: "#8A8A8A" },
  silver: { name: "Sterling Silver", hex: "#C9C9C9" }, gold: { name: "18k Gold", hex: "#C8A560" }, rosegold: { name: "Rose Gold", hex: "#D5A48B" },
  tortoise: { name: "Tortoise", hex: "#5E3A1F" }, crystal: { name: "Crystal", hex: "#E8E3DA" }, honey: { name: "Honey", hex: "#C99A4A" },
  plum: { name: "Plum", hex: "#4B2A45" }, midnight: { name: "Midnight", hex: "#141A2A" }, pearl: { name: "Pearl", hex: "#EDE9E1" },
  indigo: { name: "Indigo", hex: "#2E3A59" }, washedIndigo: { name: "Washed Indigo", hex: "#6B7A99" }, ecru: { name: "Ecru", hex: "#E4DCCB" },
  vermilion: { name: "Vermilion", hex: "#B8322A" }, magenta: { name: "Magenta", hex: "#8E2A5B" }, peacock: { name: "Peacock", hex: "#1F5F6B" },
} satisfies Record<string, Colourway>;
type CK = keyof typeof C;
const ACCENTS: CK[] = ["oxblood", "forest", "moss", "claret", "terracotta", "saffron", "blush", "rose", "lavender", "powder", "cobalt", "emerald", "plum", "butter", "sage", "olive"];

// -------------------------------------------------------------- Naming ----
const NAMES = [
  "Ines", "Aurelio", "Sibyl", "Marlowe", "Cassian", "Odile", "Lucienne", "Thea", "Ansel", "Beau", "Ottoline", "Rafe", "Solenne", "Ambrose", "Delphine",
  "Corin", "Elowen", "Idris", "Maren", "Lior", "Sabine", "Tobiah", "Vesper", "Wren", "Yael", "Halcyon", "Isolde", "Jonah", "Kiran", "Lucia", "Noor",
  "Perrin", "Romilly", "Serafin", "Anouk", "Bastien", "Clemence", "Dorian", "Esme", "Florian", "Greta", "Hugo", "Iris", "Jules", "Klara", "Lenz",
  "Margaux", "Nils", "Ophelia", "Pascal", "Quentin", "Rosalind", "Sylvie", "Tamsin", "Ulla", "Valentin", "Willa", "Xavier", "Yves", "Zelie", "Astrid",
  "Benedikt", "Cosima", "Dagny", "Elio", "Freja", "Gaspard", "Hedda", "Ivo", "Juno", "Kaspar", "Liv", "Matthias", "Nadia", "Oskar", "Paloma", "Remi",
  "Saoirse", "Theo", "Una", "Viggo", "Wilhelmina", "Xenia", "Yusuf", "Zora", "Adair", "Blaise", "Celestine", "Dashiell", "Eulalie", "Fenwick",
  "Gwendolen", "Harlan", "Imogen", "Jasper", "Katarina", "Leopold", "Mirabel", "Nikolai", "Octavia", "Amara", "Bodhi", "Calla", "Devi", "Ezra", "Farah",
];
let nameCursor = 0;
const nextName = () => NAMES[nameCursor++ % NAMES.length];

// --------------------------------------------------------------- Images ----
// Unsplash photo ids grouped by subject. A pool is only ever used by the department and
// category it is named for. `npm run images:audit` checks each id against Unsplash's own
// tags and description and writes anything mismatched to image-exclusions.json.
const W = {
  general: [
    "photo-1515886657613-9f3515b0c78f", "photo-1529139574466-a303027c1d8b", "photo-1496747611176-843222e1e57c", "photo-1487222477894-8943e31ef7b2",
    "photo-1524504388940-b1c1722653e1", "photo-1469334031218-e382a71b716b", "photo-1485968579580-b6d095142e6e", "photo-1434389677669-e08b4cac3105",
    "photo-1581044777550-4cfa60707c03", "photo-1572804013309-59a88b7e92f1", "photo-1539008835657-9e8e9680c956", "photo-1502716119720-b23a93e5fe1b",
    "photo-1516762689617-e1cffcef479d", "photo-1554412933-514a83d2f3c8", "photo-1490725263030-1f0521cec8ec", "photo-1513094735237-8f2714d57c13",
    "photo-1495385794356-15371f348c31", "photo-1469504512102-900f29606341", "photo-1525507119028-ed4c629a60a3", "photo-1529374255404-311a2a4f1fd9",
    "photo-1485462537746-965f33f954f6", "photo-1479064555552-3ef4979f8908", "photo-1548624313-0396c75e4b1a", "photo-1610652492500-ded49ceeb378",
    "photo-1618354691373-d851c5c3a990", "photo-1620799140408-edc6dcb6d633", "photo-1617922001439-4a2e6562f328", "photo-1614252235316-8c857d38b5f4",
    "photo-1618932260643-eee4a2f652a6", "photo-1622519407650-3df9883f76a5", "photo-1605763240004-7e93b172d754", "photo-1608228088998-57828365d486",
    "photo-1593030761757-71fae45fa0e7", "photo-1589363460779-cd717d2ed8fa", "photo-1591047139829-d91aecb6caea", "photo-1487744480471-9ca1bca6fb7d",
    "photo-1551232864-3f0890e580d9", "photo-1549062572-544a64fb0c56", "photo-1500917293891-ef795e70e1f6", "photo-1506152983158-b4a74a01c721",
    "photo-1527010154944-f2241763d806", "photo-1531123897727-8f129e1688ce", "photo-1502767089025-6572583495b0", "photo-1524638431109-93d95c968f03",
    "photo-1490481651871-ab68de25d43d", "photo-1521334884684-d80222895322", "photo-1512436991641-6745cdb1723f", "photo-1508214751196-bcfd4ca60f91",
    "photo-1502823403499-6ccfcf4fb453", "photo-1524250502761-1ac6f2e30d43", "photo-1550614000-4b9519e02a88",
  ],
  coats: ["photo-1539109136881-3be0616acf4b", "photo-1544022613-e87ca75a784a", "photo-1502163140606-888448ae8cfe", "photo-1524250502761-1ac6f2e30d43", "photo-1548624313-0396c75e4b1a", "photo-1485968579580-b6d095142e6e"],
  dresses: ["photo-1509631179647-0177331693ae", "photo-1583744946564-b52ac1c389c8", "photo-1566174053879-31528523f8ae", "photo-1595777457583-95e059d581b8", "photo-1520367445093-50dc08a59d9d", "photo-1564584217132-2271feaeb3c5", "photo-1503342217505-b0a15ec3261c", "photo-1515886657613-9f3515b0c78f"],
  knitwear: ["photo-1529139574466-a303027c1d8b", "photo-1475180098004-ca77a66827be", "photo-1434389677669-e08b4cac3105", "photo-1524504388940-b1c1722653e1"],
  sarees: ["photo-1583391733956-3750e0ff4e8b", "photo-1610030469983-98e550d6193c", "photo-1617627143750-d86bc21e42bb", "photo-1595777216528-071e0127ccbf", "photo-1583846783214-7229a91b20ed"],
  heels: ["photo-1595950653106-6c9ebd614d3a", "photo-1515347619252-60a4bf4fff4f", "photo-1533867617858-e7b97e060509", "photo-1596703928966-f2a9c2ea8a6f"],
  flats: ["photo-1608256246200-53e635b5b65f", "photo-1614252369475-531eba835eb1", "photo-1543163521-1bf539c55dd2"],
  ballerinas: ["photo-1560343090-f0409e92791a", "photo-1603808033192-082d6919d3e1", "photo-1600185365926-3a2ce3cdb9eb"],
  sandals: ["photo-1562273138-f46be4ebdf33", "photo-1544441893-675973e31985", "photo-1603487742131-4160ec999306"],
  boots: ["photo-1605812860427-4024433a70fd", "photo-1520639888713-7851133b1ed0", "photo-1638247025967-b4e38f787b76", "photo-1575537302964-96cd47c06b1b"],
} as const;
const W_SHOES_ALL = [...W.heels, ...W.flats, ...W.ballerinas, ...W.sandals, ...W.boots];

const M = {
  general: [
    "photo-1520975954732-35dd22299614", "photo-1507679799987-c73779587ccf", "photo-1594938298603-c8148c4c4d1b", "photo-1617137968427-85924c800a22",
    "photo-1488161628813-04466f872be2", "photo-1506794778202-cad84cf45f1d", "photo-1500648767791-00dcc994a43e", "photo-1519085360753-af0119f7cbe7",
    "photo-1492562080023-ab3db95bfbce", "photo-1531384441138-2736e62e0919", "photo-1552374196-1ab2a1c593e8", "photo-1516826957135-700dedea698c",
    "photo-1517365830460-955ce3ccd263", "photo-1602810318383-e386cc2a3ccf", "photo-1620012253295-c15cc3e65df4", "photo-1598554747436-c9293d6a588f",
    "photo-1596755094514-f87e34085b2c", "photo-1562157873-818bc0726f68", "photo-1618517351616-38fb9c5210c6", "photo-1583743814966-8936f5b7be1a",
    "photo-1521572163474-6864f9cf17ab", "photo-1503341504253-dff4815485f1", "photo-1564859228273-274232fdb516", "photo-1576871337622-98d48d1cf531",
    "photo-1610288311735-39b7facbd095", "photo-1614975059251-992f11792b9f", "photo-1579298245158-33e8f568f7d3", "photo-1551028719-00167b16eac5",
    "photo-1520975661595-6453be3f7070", "photo-1541099649105-f69ad21f3246", "photo-1576995853123-5a10305d93c0", "photo-1542272604-787c3835535d",
    "photo-1558171813-4c088753af8f",
  ],
  coats: ["photo-1520975954732-35dd22299614", "photo-1558171813-4c088753af8f", "photo-1617137968427-85924c800a22", "photo-1520975661595-6453be3f7070"],
  jackets: ["photo-1551028719-00167b16eac5", "photo-1579298245158-33e8f568f7d3", "photo-1552374196-1ab2a1c593e8", "photo-1531384441138-2736e62e0919"],
  tailoring: ["photo-1507679799987-c73779587ccf", "photo-1519085360753-af0119f7cbe7", "photo-1594938298603-c8148c4c4d1b", "photo-1492562080023-ab3db95bfbce"],
  knitwear: ["photo-1576871337622-98d48d1cf531", "photo-1610288311735-39b7facbd095", "photo-1614975059251-992f11792b9f", "photo-1564859228273-274232fdb516"],
  shirts: ["photo-1598554747436-c9293d6a588f", "photo-1596755094514-f87e34085b2c", "photo-1562157873-818bc0726f68", "photo-1618517351616-38fb9c5210c6", "photo-1583743814966-8936f5b7be1a", "photo-1620012253295-c15cc3e65df4"],
  tops: ["photo-1521572163474-6864f9cf17ab", "photo-1503341504253-dff4815485f1", "photo-1602810318383-e386cc2a3ccf"],
  jeans: ["photo-1541099649105-f69ad21f3246", "photo-1576995853123-5a10305d93c0", "photo-1542272604-787c3835535d"],
  flats: ["photo-1614253429340-98120bd6d753", "photo-1449505278894-297fdb3edbc1", "photo-1549298916-b41d501d3772", "photo-1491553895911-0055eca6402d"],
  boatShoes: ["photo-1542291026-7eec264c27ff", "photo-1520256862855-398228c41684", "photo-1605348532760-6753d2c43329"],
} as const;
const M_SHOES_ALL = [...M.flats, ...M.boatShoes];

const U = {
  bags: ["photo-1548036328-c9fa89d128fa", "photo-1584917865442-de89df76afd3", "photo-1594223274512-ad4803739b7c", "photo-1591561954557-26941169b49e", "photo-1566150905458-1bf1fc113f0d", "photo-1553062407-98eeb64c6a62", "photo-1610398752800-146f269dfcc8", "photo-1590874103328-eac38a683ce7", "photo-1548863227-3af567fc3b27", "photo-1559563458-527698bf5295", "photo-1575032617751-6ddec2089882", "photo-1564422170194-896b89110ef8", "photo-1622560480605-d83c853bc5c3", "photo-1601924994987-69e26d50dc26", "photo-1614179689702-355944cd0918", "photo-1525328437458-0c4d4db7cab4"],
  smallLeather: ["photo-1627123424574-724758594e93", "photo-1524498250077-390f9e378fc0", "photo-1547949003-9792a18a2601", "photo-1544816155-12df9643f363", "photo-1597633425046-08f5110420b5", "photo-1600857062241-98e5dba7f214"],
  belts: ["photo-1605733513597-a8f8341084e6", "photo-1624222247344-550fb60583dc", "photo-1553143820-6bb68bc34679"],
  necklaces: ["photo-1599643478518-a784e5dc4c8f", "photo-1611591437281-460bfbe1220a", "photo-1535632066927-ab7c9ab60908", "photo-1617038220319-276d3cfab638", "photo-1630019852942-f89202989a59"],
  earrings: ["photo-1588444650733-d0767b753fc8", "photo-1596944924616-7b38e7cfac36", "photo-1576022162028-7808c0a0ea50", "photo-1635767798638-3e25273a8236"],
  rings: ["photo-1605100804763-247f67b3557e", "photo-1515562141207-7a88fb7ce338", "photo-1602751584552-8ba73aad10e1", "photo-1598560917505-59a3ad559071", "photo-1589128777073-263566ae5e4d"],
  bracelets: ["photo-1611085583191-a3b181a88401", "photo-1573408301185-9146fe634ad0", "photo-1548690312-e3b507d8c110"],
  bangles: ["photo-1603561591411-07134e71a2a9", "photo-1601121141461-9d6647bca1ed"],
  anklets: ["photo-1515377905703-c4788e51af15", "photo-1506630448388-4e683c67ddb0"],
  pendants: ["photo-1611591437281-460bfbe1220a", "photo-1617038220319-276d3cfab638", "photo-1599643478518-a784e5dc4c8f"],
  chains: ["photo-1535632066927-ab7c9ab60908", "photo-1630019852942-f89202989a59"],
  brooches: ["photo-1573408301185-9146fe634ad0", "photo-1548690312-e3b507d8c110"],
  sets: ["photo-1515377905703-c4788e51af15", "photo-1611085583191-a3b181a88401", "photo-1599643478518-a784e5dc4c8f"],
  watches: ["photo-1523170335258-f5ed11844a49", "photo-1524592094714-0f0654e20314", "photo-1522312346375-d1a52e2b99b3", "photo-1524805444758-089113d48a6d", "photo-1508057198894-247b23fe5ade", "photo-1547996160-81dfa63595aa", "photo-1539874754764-5a96559165b0", "photo-1434056886845-dac89ffe9b56"],
  eyewear: ["photo-1572635196237-14b3f281503f", "photo-1511499767150-a48a237f0083", "photo-1601751818941-571144562ff8", "photo-1508296695146-257a814070b4", "photo-1577803645773-f96470509666", "photo-1473496169904-658ba7c44d8a", "photo-1556306535-0f09a537f0a3", "photo-1574258495973-f010dfbb5371"],
  fragrance: ["photo-1541643600914-78b084683601", "photo-1523293182086-7651a899d37f", "photo-1594035910387-fea47794261f", "photo-1588405748880-12d1d2a59f75", "photo-1592945403244-b3fbafd7f539", "photo-1567539855364-5ad9ffe6b9a9", "photo-1595425970377-c9703cf48b6d", "photo-1547887538-e3a2f32cb1cc"],
  objects: ["photo-1595535373192-fc8935bacd89", "photo-1602874801006-e26c4c5b5e3e", "photo-1603006905003-be475563bc59", "photo-1608181831718-c9ffd8728e75", "photo-1513519245088-0e12902e5a38"],
} as const;
const JEWELLERY_ALL = [...U.necklaces, ...U.earrings, ...U.rings, ...U.bracelets, ...U.bangles, ...U.anklets, ...U.pendants, ...U.chains, ...U.brooches, ...U.sets];
const LEATHER_ALL = [...U.bags, ...U.smallLeather, ...U.belts];

// ----------------------------------------------------------- Overrides ----
// src/data/image-overrides.json lets you hand-pick photography per department.category
// (e.g. "women.dresses": ["photo-…", …]) without editing this file. Ids listed there
// replace the built-in pool for that slot; detail shots still come from the same department.
const overridesPath = resolve(process.cwd(), "src/data/image-overrides.json");
const OVERRIDES: Record<string, string[]> = existsSync(overridesPath) ? (JSON.parse(readFileSync(overridesPath, "utf8")) as { pools?: Record<string, string[]> }).pools ?? {} : {};

// ---------------------------------------------------------- Exclusions ----
const exclusionsPath = resolve(process.cwd(), "src/data/image-exclusions.json");
const EXCLUDED = new Set<string>(existsSync(exclusionsPath) ? (JSON.parse(readFileSync(exclusionsPath, "utf8")) as { exclude: string[] }).exclude : []);
const usable = (pool: readonly string[]) => {
  const ok = pool.filter((id) => !EXCLUDED.has(id));
  return ok.length >= 2 ? ok : pool;
};

// ------------------------------------------------------------- Recipes ----
interface Recipe {
  category: CategorySlug;
  department: Department;
  count: number;
  types: readonly string[];
  materials: readonly string[];
  price: [number, number];
  sizes: readonly string[];
  colours: readonly CK[];
  pool: readonly string[];
  /** Detail shots may draw from a wider, same-department pool. */
  altPool?: readonly string[];
  crop: CropStrategy;
  origin: readonly string[];
  blurb: readonly string[];
  fit?: readonly string[];
  /** Pin a material to a type so a tulle gown is never "100% cotton jersey". */
  materialByType?: Record<string, string>;
}

const RTW_SIZES = ["XS", "S", "M", "L", "XL"] as const;
const MEN_SIZES = ["44", "46", "48", "50", "52", "54"] as const;
const DENIM_W = ["25", "26", "27", "28", "29", "30", "31", "32"] as const;
const DENIM_M = ["29", "30", "31", "32", "33", "34", "36"] as const;
const WOMEN_SHOES = ["36", "37", "38", "39", "40", "41"] as const;
const MEN_SHOES = ["40", "41", "42", "43", "44", "45"] as const;
const RING_SIZES = ["50", "52", "54", "56", "58"] as const;
const ONE = ["One Size"] as const;
const ITALY = ["Made in Italy"] as const;
const IT_PT = ["Made in Italy", "Made in Portugal"] as const;
const SCOT = ["Made in Scotland", "Made in Italy"] as const;
const FR = ["Made in France"] as const;
const INDIA = ["Handwoven in Varanasi", "Handwoven in Kanchipuram", "Made in Kolkata"] as const;

const WOMEN_NEUTRALS: CK[] = ["black", "ivory", "camel", "charcoal", "navy", "oat", "espresso", "dove"];
const MEN_NEUTRALS: CK[] = ["navy", "charcoal", "black", "camel", "stone", "espresso", "olive", "forest"];
const LEATHER: CK[] = ["black", "cognac", "espresso", "camel", "oxblood", "chocolate", "tobacco", "bone"];

const RECIPES: Recipe[] = [
  // ------------------------------------------------------------ Women RTW
  { category: "coats", department: "women", count: 9, types: ["Wool Coat", "Double-Faced Cashmere Coat", "Belted Trench", "Cocoon Coat", "Car Coat", "Wrap Coat", "Peacoat", "Collarless Wool Coat"], materials: ["Double-faced wool and cashmere", "100% pure new wool", "Cotton gabardine, bonded", "Wool-alpaca bouclé"], price: [129, 299], sizes: RTW_SIZES, colours: [...WOMEN_NEUTRALS, "oxblood", "forest"], pool: W.coats, altPool: W.general, crop: "faces,entropy", origin: ITALY, blurb: ["Cut with a generous, unhurried silhouette that falls straight from the shoulder.", "A quiet outer layer built to be worn for decades, not seasons."], fit: ["Relaxed fit", "Oversized fit", "Regular fit"] },
  { category: "jackets", department: "women", count: 6, types: ["Shearling Jacket", "Padded Silk Jacket", "Cropped Leather Jacket", "Quilted Jacket", "Collarless Bouclé Jacket", "Cropped Denim Jacket"], materials: ["Merino shearling", "Silk-wool twill", "100% nappa lambskin", "Quilted cotton sateen", "Wool bouclé", "Rigid Japanese denim"], price: [69, 199], sizes: RTW_SIZES, colours: [...WOMEN_NEUTRALS, "cognac", "indigo"], pool: W.general, crop: "faces,entropy", origin: ITALY, blurb: ["Short in the body, clean at the shoulder, made to sit over a knit or a dress.", "The jacket you leave on indoors."], fit: ["Cropped fit", "Regular fit"] },
  { category: "tailoring", department: "women", count: 7, types: ["Double-Breasted Blazer", "Single-Breasted Blazer", "Collarless Jacket", "Waistcoat", "Tuxedo Jacket", "Longline Blazer"], materials: ["100% wool crepe", "100% virgin wool flannel", "Wool-silk hopsack", "Stretch wool barathea"], price: [89, 169], sizes: RTW_SIZES, colours: [...WOMEN_NEUTRALS, "oxblood", "forest"], pool: W.general, crop: "faces,entropy", origin: ITALY, blurb: ["Half-canvassed, hand-padded lapels and a softly rolled shoulder.", "Structured enough to read as tailoring, soft enough to forget you are wearing it."], fit: ["Regular fit", "Oversized fit"] },
  { category: "knitwear", department: "women", count: 9, types: ["Cashmere Crewneck", "Ribbed Turtleneck", "Cashmere Cardigan", "Oversized Sweater", "Silk-Cashmere Polo", "Mock-Neck Sweater", "Cable Knit", "Fine-Gauge Cardigan"], materials: ["100% Grade-A Mongolian cashmere", "100% extra-fine merino", "Cashmere-silk", "Brushed alpaca-wool"], price: [39, 99], sizes: RTW_SIZES, colours: ["oat", "ivory", "camel", "black", "charcoal", "sage", "blush", "moss", "navy", "butter", "lavender", "powder"], pool: W.knitwear, altPool: W.general, crop: "faces,entropy", origin: SCOT, blurb: ["Spun and knitted in a family mill that has worked the same yarn for four generations.", "Fully fashioned with hand-linked seams for a cleaner drape."], fit: ["Regular fit", "Relaxed fit", "Oversized fit"] },
  { category: "dresses", department: "women", count: 11, types: ["Layered Tulle Midi Dress", "Silk Organza Corset Dress", "Draped Satin Slip Gown", "Ruffled Chiffon Maxi Dress", "Hand-Embroidered Voile Dress", "Bias-Cut Charmeuse Gown", "Sheer-Sleeve Tea Dress", "Smocked Cotton Voile Dress", "Cloud Tulle Ball Gown", "Pleated Lamé Column Dress", "Off-Shoulder Taffeta Dress"], materials: ["100% silk organza over a silk slip", "Layered 100% silk tulle", "100% mulberry silk charmeuse", "100% silk chiffon, hand-rolled hems", "100% organic cotton voile, hand-embroidered", "100% silk taffeta", "100% silk satin"], price: [59, 149], sizes: RTW_SIZES, colours: ["blush", "powder", "lavender", "butter", "pearl", "ivory", "sage", "rose", "claret", "midnight", "black"], materialByType: { "Layered Tulle Midi Dress": "Layered 100% silk tulle", "Silk Organza Corset Dress": "100% silk organza over a silk slip", "Draped Satin Slip Gown": "100% silk satin", "Ruffled Chiffon Maxi Dress": "100% silk chiffon, hand-rolled hems", "Hand-Embroidered Voile Dress": "100% organic cotton voile, hand-embroidered", "Bias-Cut Charmeuse Gown": "100% mulberry silk charmeuse", "Sheer-Sleeve Tea Dress": "100% silk chiffon, hand-rolled hems", "Smocked Cotton Voile Dress": "100% organic cotton voile, hand-embroidered", "Cloud Tulle Ball Gown": "Layered 100% silk tulle", "Pleated Lamé Column Dress": "Pleated silk lamé", "Off-Shoulder Taffeta Dress": "100% silk taffeta" }, pool: W.dresses, altPool: W.general, crop: "faces,entropy", origin: IT_PT, blurb: ["Layers of tulle and silk that move like weather; a dress made for the last light of the day.", "Cut on the bias and finished by hand, so the fabric floats rather than falls.", "Romantic without being sweet: sheer sleeves, a corseted waist, and a hem that catches the air."], fit: ["Regular fit", "Relaxed fit"] },
  { category: "tops", department: "women", count: 6, types: ["Heavyweight Boxy Tee", "Drop-Shoulder Signature Tee", "Washed Cropped Baby Tee", "Silk Camisole", "Longline Rib Tank", "Sheer Organza Shell"], materials: ["100% Supima cotton, 300 gsm heavyweight jersey", "100% organic pima cotton, garment-washed", "100% mulberry silk charmeuse", "100% extra-fine merino rib", "100% silk organza"], price: [19, 49], sizes: RTW_SIZES, colours: ["white", "ecru", "black", "blush", "sage", "powder", "butter", "charcoal"], materialByType: { "Heavyweight Boxy Tee": "100% Supima cotton, 300 gsm heavyweight jersey", "Drop-Shoulder Signature Tee": "100% organic pima cotton, garment-washed", "Washed Cropped Baby Tee": "100% organic pima cotton, garment-washed", "Silk Camisole": "100% mulberry silk charmeuse", "Longline Rib Tank": "100% extra-fine merino rib", "Sheer Organza Shell": "100% silk organza" }, pool: W.general, crop: "faces,entropy", origin: IT_PT, blurb: ["A tee with real weight and a boxy, dropped shoulder: the piece that makes jeans look considered.", "Garment-washed for softness, cut for shape, and made to be the most-worn thing you own."], fit: ["Boxy fit", "Cropped fit", "Regular fit"] },
  { category: "blouses", department: "women", count: 6, types: ["Tie-Neck Blouse", "Silk Blouse", "Pussy-Bow Blouse", "Ruffled Blouse", "Wrap Blouse", "Bishop-Sleeve Blouse"], materials: ["100% silk twill", "100% silk crepe de chine", "100% silk georgette", "Cotton-silk voile"], price: [39, 79], sizes: RTW_SIZES, colours: ["ivory", "white", "black", "blush", "powder", "oxblood", "butter", "sage"], pool: W.general, crop: "faces,entropy", origin: ITALY, blurb: ["Soft, fluid and finished by hand at the collar and cuff.", "A blouse that does the work of a piece of jewellery."], fit: ["Regular fit", "Relaxed fit"] },
  { category: "shirts", department: "women", count: 6, types: ["Silk Shirt", "Poplin Shirt", "Oversized Shirt", "Linen Shirt", "Tuxedo Shirt", "Striped Cotton Shirt"], materials: ["100% silk twill", "100% two-ply cotton poplin", "100% washed linen", "Cotton oxford"], price: [39, 69], sizes: RTW_SIZES, colours: ["white", "ivory", "black", "powder", "sand", "navy"], pool: W.general, crop: "faces,entropy", origin: IT_PT, blurb: ["Mother-of-pearl buttons, French seams, and a collar that holds its shape.", "Cut fuller through the body, cleaner at the cuff."], fit: ["Regular fit", "Oversized fit"] },
  { category: "skirts", department: "women", count: 6, types: ["Pleated Midi Skirt", "Pencil Skirt", "Bias-Cut Slip Skirt", "A-Line Wool Skirt", "Wrap Skirt", "Maxi Skirt"], materials: ["100% wool crepe", "Silk satin", "100% wool flannel", "100% silk twill", "Cotton poplin"], price: [39, 89], sizes: RTW_SIZES, colours: ["black", "ivory", "camel", "navy", "oxblood", "charcoal", "sage", "espresso"], pool: W.general, crop: "faces,entropy", origin: ITALY, blurb: ["Sits at the natural waist and falls in one uninterrupted line.", "Movement built in at the hem, precision at the waist."], fit: ["Regular fit"] },
  { category: "trousers", department: "women", count: 6, types: ["Wide-Leg Trouser", "Pleated Trouser", "Straight Trouser", "Tapered Wool Trouser", "Silk Palazzo Trouser", "High-Waist Trouser"], materials: ["100% wool crepe", "100% wool flannel", "100% silk twill", "Stretch wool gabardine", "Linen-viscose"], price: [49, 89], sizes: RTW_SIZES, colours: [...WOMEN_NEUTRALS, "forest"], pool: W.general, crop: "faces,entropy", origin: ITALY, blurb: ["A trouser with real room to move and a hem that breaks just so.", "Precise at the waist, fluid everywhere else."], fit: ["Wide fit", "Straight fit", "Tapered fit"] },
  { category: "jeans", department: "women", count: 5, types: ["Straight-Leg Jean", "Wide-Leg Jean", "High-Rise Slim Jean", "Barrel-Leg Jean", "Cropped Flare Jean"], materials: ["100% cotton Japanese selvedge denim", "100% organic cotton denim", "Comfort-stretch denim"], price: [49, 89], sizes: DENIM_W, colours: ["indigo", "washedIndigo", "black", "ecru"], pool: W.general, crop: "faces,entropy", origin: ITALY, blurb: ["Woven on shuttle looms in Okayama and finished without a single distress mark.", "A jean cut like a trouser."], fit: ["High rise", "Mid rise"] },
  { category: "sarees", department: "women", count: 4, types: ["Silk Saree", "Handwoven Linen Saree", "Organza Saree", "Banarasi Brocade Saree"], materials: ["Mulberry silk with zari border", "Handwoven linen", "Silk organza", "Banarasi silk brocade"], price: [79, 249], sizes: ONE, colours: ["vermilion", "magenta", "peacock", "ivory", "saffron", "emerald", "gold"], pool: W.sarees, crop: "faces,entropy", origin: INDIA, blurb: ["Six yards woven by hand over several weeks, with an unstitched blouse piece.", "Drapes with the weight only real silk has."] },
  // -------------------------------------------------------------- Men RTW
  { category: "coats", department: "men", count: 7, types: ["Overcoat", "Raglan Coat", "Chesterfield Coat", "Wool Peacoat", "Mac", "Double-Faced Cashmere Coat"], materials: ["Double-faced wool and cashmere", "100% melton wool", "Cotton gabardine, bonded", "Cashmere-blend twill"], price: [129, 299], sizes: MEN_SIZES, colours: MEN_NEUTRALS, pool: M.coats, altPool: M.general, crop: "faces,entropy", origin: ITALY, blurb: ["Long enough to cover a jacket, clean enough to wear over a knit.", "Built for weather in the way only wool can be."], fit: ["Regular fit", "Relaxed fit"] },
  { category: "jackets", department: "men", count: 5, types: ["Bomber Jacket", "Field Jacket", "Suede Jacket", "Harrington Jacket", "Quilted Jacket"], materials: ["Waxed cotton", "Italian suede", "Wool-nylon twill", "Quilted cotton sateen"], price: [79, 199], sizes: MEN_SIZES, colours: [...MEN_NEUTRALS, "tobacco", "cognac"], pool: M.jackets, altPool: M.general, crop: "faces,entropy", origin: ITALY, blurb: ["A short jacket with a clean shoulder and pockets you will actually use.", "Made for the months when a coat is too much."], fit: ["Regular fit"] },
  { category: "tailoring", department: "men", count: 7, types: ["Unstructured Blazer", "Double-Breasted Jacket", "Two-Piece Suit", "Dinner Jacket", "Flannel Suit", "Travel Blazer"], materials: ["Wool-silk-linen hopsack", "100% virgin wool flannel", "High-twist wool", "Wool barathea"], price: [99, 229], sizes: MEN_SIZES, colours: ["navy", "charcoal", "black", "camel", "stone", "midnight", "espresso", "forest"], pool: M.tailoring, altPool: M.general, crop: "faces,entropy", origin: ITALY, blurb: ["Half-canvassed with a natural shoulder and a lapel that rolls, not folds.", "Cut soft, finished hard."], fit: ["Regular fit", "Slim fit"] },
  { category: "knitwear", department: "men", count: 7, types: ["Cashmere Crewneck", "Roll-Neck", "Shawl-Collar Cardigan", "Cable Knit", "Cashmere Hoodie", "Fine-Gauge V-Neck"], materials: ["100% Grade-A Mongolian cashmere", "100% extra-fine merino", "100% lambswool, brushed", "Baby cashmere, 12-gauge"], price: [39, 99], sizes: RTW_SIZES, colours: [...MEN_NEUTRALS, "oat", "moss", "slate"], pool: M.knitwear, altPool: M.general, crop: "faces,entropy", origin: SCOT, blurb: ["Knitted on vintage frames in the Scottish Borders and finished by hand.", "The kind of weight that works from October to April."], fit: ["Regular fit", "Relaxed fit"] },
  { category: "shirts", department: "men", count: 7, types: ["Oxford Shirt", "Poplin Shirt", "Linen Shirt", "Flannel Overshirt", "Camp-Collar Shirt", "Twill Shirt", "Band-Collar Shirt"], materials: ["100% two-ply cotton oxford", "100% Sea Island cotton poplin", "100% washed Irish linen", "Brushed cotton flannel"], price: [39, 69], sizes: MEN_SIZES, colours: ["white", "powder", "ivory", "navy", "sand", "olive", "charcoal", "sage"], pool: M.shirts, altPool: M.general, crop: "faces,entropy", origin: IT_PT, blurb: ["Single-needle stitched with a collar that sits right open or closed.", "Softer with every wash. Better with every year."], fit: ["Regular fit", "Slim fit"] },
  { category: "tops", department: "men", count: 4, types: ["Heavyweight Boxy Tee", "Drop-Shoulder Signature Tee", "Garment-Washed Long-Sleeve Tee", "Merino Polo"], materials: ["100% Supima cotton, 300 gsm heavyweight jersey", "100% organic pima cotton, garment-washed", "100% extra-fine merino"], price: [17, 45], sizes: RTW_SIZES, colours: ["white", "ecru", "charcoal", "black", "sage", "stone", "navy"], materialByType: { "Heavyweight Boxy Tee": "100% Supima cotton, 300 gsm heavyweight jersey", "Drop-Shoulder Signature Tee": "100% organic pima cotton, garment-washed", "Garment-Washed Long-Sleeve Tee": "100% organic pima cotton, garment-washed", "Merino Polo": "100% extra-fine merino" }, pool: M.tops, altPool: M.general, crop: "faces,entropy", origin: IT_PT, blurb: ["A heavier jersey that holds its shape at the neck and drapes from the shoulder.", "The plainest thing we make, and the hardest to get right."], fit: ["Boxy fit", "Regular fit"] },
  { category: "trousers", department: "men", count: 6, types: ["Pleated Trouser", "Flat-Front Trouser", "Wide-Leg Trouser", "Drawstring Trouser", "Flannel Trouser", "Cavalry Twill Trouser"], materials: ["100% wool flannel", "High-twist wool", "Cotton drill", "Wool gabardine"], price: [49, 89], sizes: MEN_SIZES, colours: MEN_NEUTRALS, pool: M.general, crop: "faces,entropy", origin: ITALY, blurb: ["A higher rise, a fuller leg, a hem that falls straight to the shoe.", "As comfortable seated as standing."], fit: ["Regular fit", "Wide fit", "Tapered fit"] },
  { category: "jeans", department: "men", count: 4, types: ["Straight Jean", "Relaxed Tapered Jean", "Slim Jean", "Wide Jean"], materials: ["100% cotton Japanese selvedge denim", "100% organic cotton denim", "Comfort-stretch denim"], price: [49, 89], sizes: DENIM_M, colours: ["indigo", "washedIndigo", "black", "ecru"], pool: M.jeans, altPool: M.general, crop: "faces,entropy", origin: ITALY, blurb: ["Woven on shuttle looms in Okayama and finished without a single distress mark.", "Breaks in slowly and keeps its colour."], fit: ["Regular fit", "Slim fit"] },
  // ---------------------------------------------------------- Footwear
  { category: "heels", department: "women", count: 3, types: ["Slingback Pump", "Kitten-Heel Mule", "Pointed Court Shoe"], materials: ["100% nappa lambskin", "Patent leather", "Suede"], price: [59, 119], sizes: WOMEN_SHOES, colours: ["black", "ivory", "oxblood", "cognac", "bone"], pool: W.heels, altPool: W_SHOES_ALL, crop: "entropy", origin: ITALY, blurb: ["A heel you can stand in all evening, on a last we spent two years refining.", "Sharp at the toe, gentle everywhere else."] },
  { category: "flats", department: "women", count: 3, types: ["Leather Loafer", "Pointed Flat", "Penny Loafer"], materials: ["100% box calf leather", "Suede", "Grained calfskin"], price: [49, 99], sizes: WOMEN_SHOES, colours: ["black", "espresso", "camel", "oxblood", "bone"], pool: W.flats, altPool: W_SHOES_ALL, crop: "entropy", origin: ITALY, blurb: ["Blake-stitched with a low profile that disappears under the trouser.", "Comfortable from the first wear."] },
  { category: "ballerinas", department: "women", count: 2, types: ["Ballet Flat", "Mary Jane Ballerina"], materials: ["100% nappa lambskin", "Silk satin"], price: [39, 79], sizes: WOMEN_SHOES, colours: ["black", "blush", "ivory", "bone", "oxblood"], pool: W.ballerinas, altPool: W_SHOES_ALL, crop: "entropy", origin: ITALY, blurb: ["Soft-soled and unlined so the leather moulds to the foot.", "Weightless."] },
  { category: "sandals", department: "women", count: 2, types: ["Strappy Sandal", "Slide Sandal"], materials: ["100% nappa lambskin", "Vegetable-tanned leather"], price: [39, 89], sizes: WOMEN_SHOES, colours: ["black", "cognac", "bone", "gold"], pool: W.sandals, altPool: W_SHOES_ALL, crop: "entropy", origin: ITALY, blurb: ["Two straps and a leather sole; nothing that does not need to be there.", "For the months that ask for less."] },
  { category: "boots", department: "women", count: 3, types: ["Ankle Boot", "Knee Boot", "Chelsea Boot"], materials: ["100% box calf leather", "Suede", "Grained calfskin"], price: [89, 179], sizes: WOMEN_SHOES, colours: ["black", "espresso", "chocolate", "oxblood", "tobacco"], pool: W.boots, altPool: W_SHOES_ALL, crop: "entropy", origin: ITALY, blurb: ["Goodyear-welted, so it can be resoled for as long as you own it.", "A boot that finishes the line of a coat."] },
  { category: "flats", department: "men", count: 4, types: ["Penny Loafer", "Derby Shoe", "Double-Monk Shoe", "Leather Slipper"], materials: ["100% box calf leather", "Suede", "Cordovan", "Grained calfskin"], price: [79, 149], sizes: MEN_SHOES, colours: ["black", "espresso", "cognac", "tobacco", "oxblood"], pool: M.flats, altPool: M_SHOES_ALL, crop: "entropy", origin: ITALY, blurb: ["Goodyear-welted, so it can be resoled for as long as you own it.", "Made slowly in a Marche workshop of thirty people."] },
  { category: "boat-shoes", department: "men", count: 3, types: ["Leather Boat Shoe", "Suede Deck Shoe", "Two-Eyelet Boat Shoe"], materials: ["Waxed leather with rawhide laces", "Water-resistant suede", "Nubuck with non-slip sole"], price: [69, 119], sizes: MEN_SHOES, colours: ["cognac", "navy", "espresso", "sand"], pool: M.boatShoes, altPool: M_SHOES_ALL, crop: "entropy", origin: IT_PT, blurb: ["Hand-sewn moccasin construction with a siped rubber sole.", "Made for decks, worn everywhere."] },
  // ------------------------------------------------------- Leather goods
  { category: "bags", department: "unisex", count: 11, types: ["Structured Tote", "Shoulder Bag", "Top-Handle Bag", "Soft Hobo", "Crossbody Bag", "Weekend Holdall", "Envelope Clutch", "Bucket Bag", "Document Case", "Mini Bag", "Saddle Bag"], materials: ["100% full-grain calf leather", "Vegetable-tanned leather", "Grained calfskin", "100% nappa lambskin", "Suede with leather trim", "Smooth box calf"], price: [49, 149], sizes: ONE, colours: [...LEATHER, "ivory", "forest", "navy"], pool: U.bags, altPool: LEATHER_ALL, crop: "entropy", origin: ITALY, blurb: ["Hand-cut, edge-painted and saddle-stitched by a single artisan in our Tuscan atelier.", "Built to develop a patina worth keeping."] },
  { category: "small-leather-goods", department: "unisex", count: 6, types: ["Card Holder", "Bifold Wallet", "Zip Wallet", "Passport Holder", "Coin Purse", "Key Holder"], materials: ["100% full-grain calf leather", "Grained calfskin", "Smooth box calf"], price: [19, 59], sizes: ONE, colours: LEATHER, pool: U.smallLeather, altPool: LEATHER_ALL, crop: "entropy", origin: ITALY, blurb: ["Six pockets, one thread, edge-painted in five coats.", "Slim enough to forget it is there."] },
  { category: "belts", department: "unisex", count: 4, types: ["Leather Belt", "Reversible Belt", "Woven Leather Belt", "Slim Belt"], materials: ["Vegetable-tanned leather", "Bridle leather", "Hand-woven calf"], price: [25, 49], sizes: ["80", "85", "90", "95", "100"], colours: LEATHER, pool: U.belts, altPool: LEATHER_ALL, crop: "entropy", origin: ITALY, blurb: ["A solid brass buckle and leather that darkens with wear.", "One belt, kept for life."] },
  // ----------------------------------------------------------- Jewellery
  { category: "necklaces", department: "unisex", count: 3, types: ["Pearl Necklace", "Collar Necklace", "Layered Chain Necklace"], materials: ["Freshwater pearl and 18k gold", "18k recycled gold", "Sterling silver"], price: [19, 59], sizes: ONE, colours: ["gold", "silver", "pearl"], pool: U.necklaces, altPool: JEWELLERY_ALL, crop: "entropy", origin: ITALY, blurb: ["Cast in recycled 18k gold and finished by hand in Valenza.", "Designed to be worn against the skin, and never taken off."] },
  { category: "earrings", department: "unisex", count: 3, types: ["Hoop Earrings", "Drop Earrings", "Pearl Stud Earrings"], materials: ["18k recycled gold", "Sterling silver", "Freshwater pearl and 18k gold"], price: [15, 39], sizes: ONE, colours: ["gold", "silver", "rosegold", "pearl"], pool: U.earrings, altPool: JEWELLERY_ALL, crop: "entropy", origin: ITALY, blurb: ["Weighty enough to feel, quiet enough to wear daily.", "Hand-polished, with a secure butterfly back."] },
  { category: "rings", department: "unisex", count: 3, types: ["Signet Ring", "Stacking Ring", "Band Ring"], materials: ["18k recycled gold", "Sterling silver", "18k gold vermeil"], price: [15, 39], sizes: RING_SIZES, colours: ["gold", "silver", "rosegold"], pool: U.rings, altPool: JEWELLERY_ALL, crop: "entropy", origin: ITALY, blurb: ["Cast, not stamped, so the walls are dense and the edges soft.", "Made to be worn every day."] },
  { category: "bracelets", department: "unisex", count: 2, types: ["Cuff Bracelet", "Link Bracelet"], materials: ["18k recycled gold", "Sterling silver"], price: [19, 49], sizes: ONE, colours: ["gold", "silver"], pool: U.bracelets, altPool: JEWELLERY_ALL, crop: "entropy", origin: ITALY, blurb: ["Hand-formed and hallmarked.", "Sits close to the wrist and stays there."] },
  { category: "bangles", department: "unisex", count: 2, types: ["Slim Bangle", "Twisted Bangle"], materials: ["18k recycled gold", "18k gold vermeil"], price: [19, 45], sizes: ONE, colours: ["gold", "rosegold"], pool: U.bangles, altPool: JEWELLERY_ALL, crop: "entropy", origin: ITALY, blurb: ["Worn alone or stacked by the half-dozen.", "Solid, seamless, hand-finished."] },
  { category: "anklets", department: "unisex", count: 1, types: ["Chain Anklet"], materials: ["18k gold vermeil"], price: [15, 29], sizes: ONE, colours: ["gold", "silver"], pool: U.anklets, altPool: JEWELLERY_ALL, crop: "entropy", origin: ITALY, blurb: ["Fine enough to catch the light and nothing else."] },
  { category: "pendants", department: "unisex", count: 2, types: ["Disc Pendant", "Locket Pendant"], materials: ["18k recycled gold", "Sterling silver"], price: [19, 49], sizes: ONE, colours: ["gold", "silver"], pool: U.pendants, altPool: JEWELLERY_ALL, crop: "entropy", origin: ITALY, blurb: ["Engraved by hand on request.", "Suspended from a fine 45cm chain."] },
  { category: "chains", department: "unisex", count: 1, types: ["Curb Chain"], materials: ["18k recycled gold"], price: [25, 59], sizes: ONE, colours: ["gold", "silver"], pool: U.chains, altPool: JEWELLERY_ALL, crop: "entropy", origin: ITALY, blurb: ["Every link soldered by hand in Valenza."] },
  { category: "brooches", department: "unisex", count: 1, types: ["Sculptural Brooch"], materials: ["18k gold vermeil"], price: [17, 39], sizes: ONE, colours: ["gold", "silver"], pool: U.brooches, altPool: JEWELLERY_ALL, crop: "entropy", origin: ITALY, blurb: ["For a lapel, a knit, or the band of a hat."] },
  { category: "jewellery-sets", department: "unisex", count: 1, types: ["Pearl Necklace & Earring Set"], materials: ["Freshwater pearl and 18k gold"], price: [39, 79], sizes: ONE, colours: ["pearl", "gold"], pool: U.sets, altPool: JEWELLERY_ALL, crop: "entropy", origin: ITALY, blurb: ["Matched by hand for lustre and size, presented together."] },
  // --------------------------------------------------------- Accessories
  { category: "watches", department: "unisex", count: 2, types: ["Dress Watch", "Automatic Watch"], materials: ["Stainless steel and sapphire crystal", "18k gold and sapphire crystal"], price: [89, 199], sizes: ONE, colours: ["silver", "gold", "black"], pool: U.watches, crop: "entropy", origin: ["Swiss made"], blurb: ["A thin case, a clean dial, a leather strap that ages well.", "Wound by the wrist."] },
  { category: "eyewear", department: "unisex", count: 4, types: ["Round Sunglasses", "Square Sunglasses", "Cat-Eye Sunglasses", "Optical Frame"], materials: ["Hand-polished bio-acetate", "Titanium", "Acetate and titanium"], price: [29, 59], sizes: ONE, colours: ["tortoise", "black", "crystal", "honey", "smoke"], pool: U.eyewear, crop: "entropy", origin: IT_PT, blurb: ["Acetate block-cut, tumbled for three days and polished by hand.", "Lenses by Zeiss, with full UV protection and no logos."] },
  // ---------------------------------------------------------------- Home
  { category: "fragrance", department: "unisex", count: 4, types: ["Eau de Parfum 100ml", "Eau de Parfum 50ml", "Extrait de Parfum", "Body Oil"], materials: ["Iris, vetiver, ambrette", "Fig leaf, cedar, white musk", "Black tea, saffron, oud", "Neroli, sea salt, sandalwood"], price: [25, 59], sizes: ONE, colours: ["crystal", "smoke", "honey", "bone"], pool: U.fragrance, crop: "entropy", origin: FR, blurb: ["Composed in Grasse and bottled in hand-finished glass.", "Made to be worn close, noticed late."] },
  { category: "objects", department: "unisex", count: 2, types: ["Scented Candle", "Cashmere Throw"], materials: ["Soy wax, cotton wick, hand-poured", "Pure cashmere, 4-ply"], price: [25, 129], sizes: ONE, colours: ["bone", "oat", "camel", "charcoal"], pool: U.objects, crop: "entropy", origin: IT_PT, blurb: ["For the rooms you actually live in.", "Made in the same mills as our knitwear."] },
];

// -------------------------------------------------------------- Copy ----
const CARE: Partial<Record<CategorySlug, string>> = {
  coats: "Specialist dry clean only. Store on a wide, shaped hanger.",
  jackets: "Specialist dry clean only. Store on a shaped hanger.",
  tailoring: "Specialist dry clean only. Steam rather than iron.",
  knitwear: "Hand wash cold with cashmere shampoo. Dry flat. Store folded.",
  dresses: "Dry clean only. Cool iron on reverse if required.",
  tops: "Machine wash cold, gentle cycle. Dry flat.",
  blouses: "Dry clean, or hand wash cold and hang to dry. Cool iron.",
  shirts: "Machine wash cold on a gentle cycle. Hang to dry. Warm iron.",
  skirts: "Dry clean. Press with a cloth to protect the surface.",
  trousers: "Dry clean. Press with a cloth to protect the surface.",
  jeans: "Wash rarely, cold, inside out. Hang to dry.",
  sarees: "Dry clean only. Store wrapped in muslin, refolded seasonally.",
  bags: "Keep dry. Condition twice a year with a neutral cream.",
  "small-leather-goods": "Keep dry. Condition twice a year with a neutral cream.",
  belts: "Keep dry. Condition twice a year with a neutral cream.",
  watches: "Wipe with a soft cloth. Service every five years.",
  eyewear: "Clean with the supplied microfibre cloth. Store in the case.",
  fragrance: "Keep away from heat and direct light.",
  objects: "See enclosed care card.",
};
const SHOE_CARE = "Use cedar shoe trees. Polish with a neutral cream. Resole when needed.";
const JEWEL_CARE = "Wipe with a soft cloth after wear. Avoid perfume and chlorine.";
const SHOES: CategorySlug[] = ["heels", "flats", "ballerinas", "sandals", "boots", "boat-shoes"];
const JEWELS: CategorySlug[] = ["necklaces", "earrings", "rings", "bracelets", "bangles", "anklets", "pendants", "chains", "brooches", "jewellery-sets"];
const RTW: CategorySlug[] = ["coats", "jackets", "tailoring", "knitwear", "dresses", "tops", "blouses", "shirts", "skirts", "trousers", "jeans", "sarees"];

function details(r: Recipe, material: string, origin: string): string[] {
  const out = [material, origin, "Quality-checked twice before dispatch", "Certified fibres: OEKO-TEX® Standard 100"];
  if (RTW.includes(r.category)) {
    out.push(r.department === "men" ? "Model is 188cm and wears a size 48" : "Model is 178cm and wears a size S");
    if (r.fit) out.push(pick(r.fit));
  }
  if (r.category === "bags") out.push(pick(["Unlined", "Suede-lined", "Cotton-twill lined"]), "Includes dust bag");
  if (r.category === "small-leather-goods") out.push("Edge-painted", "Includes gift box");
  if (SHOES.includes(r.category)) out.push(pick(["Leather sole", "Leather sole with rubber insert"]), "Includes shoe bags");
  if (JEWELS.includes(r.category)) out.push("Hallmarked", `Presented in a ${BRAND} case`);
  if (r.category === "watches") out.push("Sapphire crystal", "Two-year guarantee");
  if (r.category === "eyewear") out.push("Category 3 lenses", "Includes leather case");
  return out;
}

/** High-street price points: $19.90 · $49.90 · $79.90 below $100, then $129 · $169 · $229. */
function roundPrice(v: number): number {
  if (v < 100) return Math.max(10, Math.round(v / 10) * 10) * 100 - 10; // e.g. 4990 cents
  return Math.round(v / 10) * 10 * 100 - 100; // e.g. 12900 cents
}

// ----------------------------------------------------------- Generate ----
const products: Product[] = [];
const slugs = new Set<string>();
const cursors = new Map<string, number>();
let n = 0;
const start = Date.UTC(2026, 2, 1);
const end = Date.UTC(2026, 8, 12);

for (const r of RECIPES) {
  const types = shuffle(r.types);
  const override = OVERRIDES[`${r.department}.${r.category}`];
  const pool = usable(override && override.length >= 2 ? override : r.pool);
  const altPool = r.altPool ? usable(r.altPool) : pool;
  for (let i = 0; i < r.count; i++) {
    n++;
    const type = types[i % types.length];
    let name = `${nextName()} ${type}`;
    let slug = slugify(name);
    while (slugs.has(slug)) {
      name = `${nextName()} ${type}`;
      slug = slugify(name);
    }
    slugs.add(slug);

    const material = r.materialByType?.[type] ?? pick(r.materials);
    const origin = pick(r.origin);
    const palette = shuffle(r.colours);
    const cwCount = JEWELS.includes(r.category) || r.category === "fragrance" || r.category === "watches" ? 1 + (chance(0.4) ? 1 : 0) : 1 + Math.floor(rand() * Math.min(3, palette.length - 1));
    const colourways: Colourway[] = palette.slice(0, cwCount).map((k) => C[k]);
    if (["knitwear", "dresses", "blouses", "tops"].includes(r.category) && chance(0.35)) {
      const accent = C[pick(ACCENTS)];
      if (!colourways.some((c) => c.hex === accent.hex)) colourways.push(accent);
    }

    const price = roundPrice(between(r.price[0], r.price[1]));

    // One photograph per colour variant, drawn round-robin from the category pool so
    // neighbouring products and sibling colours differ; then 1–2 shared detail shots from
    // the same-department pool. A product never repeats a photo.
    const poolKey = `${r.category}-${r.department}`;
    const chosen: string[] = [];
    const takeFrom = (src: readonly string[], key: string) => {
      let idx = cursors.get(key) ?? 0;
      for (let tries = 0; tries < src.length; tries++, idx++) {
        const id = src[idx % src.length];
        if (!chosen.includes(id)) {
          cursors.set(key, idx + 1);
          chosen.push(id);
          return id;
        }
      }
      return null;
    };
    for (let k = 0; k < colourways.length; k++) {
      if (!takeFrom(pool, poolKey)) takeFrom(altPool, `${poolKey}-alt`);
    }
    const detailCount = 1 + (chance(0.5) ? 1 : 0);
    for (let k = 0; k < detailCount; k++) takeFrom(altPool, `${poolKey}-alt`);
    const images = chosen.map((id, k) => ({
      id,
      alt: k < colourways.length ? `${BRAND} ${name} in ${colourways[k].name}` : `${BRAND} ${name}, detail view ${k - colourways.length + 1}`,
      crop: r.crop,
    }));

    // Stock per size per variant: most sizes in stock, a few low, a few sold out, and the
    // occasional variant sold through entirely.
    const soldOutVariant = chance(0.06);
    const variants: Variant[] = colourways.map((c, k) => ({
      ...c,
      sku: `${BRAND.slice(0, 2)}${String(n).padStart(4, "0")}-${slugify(c.name).toUpperCase().slice(0, 3)}`,
      image: images[k],
      sizeStock: Object.fromEntries(
        r.sizes.map((size) => {
          if (soldOutVariant && k === colourways.length - 1) return [size, 0];
          const roll = rand();
          return [size, roll < 0.08 ? 0 : roll < 0.22 ? 1 + Math.floor(rand() * 3) : 4 + Math.floor(rand() * 12)];
        }),
      ),
    }));

    const tags: string[] = [];
    const createdAt = new Date(start + rand() * (end - start));
    if (createdAt.getTime() > Date.UTC(2026, 7, 15)) tags.push("new");
    if (chance(0.08)) tags.push("icon");
    if (chance(0.05)) tags.push("limited");
    if (chance(0.12)) tags.push("editorial");

    const compareAt = chance(0.14) ? roundPrice((price / 100) * (1.25 + rand() * 0.15)) : undefined;
    const care = SHOES.includes(r.category) ? SHOE_CARE : JEWELS.includes(r.category) ? JEWEL_CARE : CARE[r.category] ?? "See enclosed care card.";

    products.push({
      id: `tysh-${String(n).padStart(4, "0")}`,
      slug,
      brand: BRAND,
      name,
      category: r.category,
      department: r.department,
      price,
      ...(compareAt ? { compareAtPrice: compareAt } : {}),
      variants,
      sizes: [...r.sizes],
      materials: material,
      origin,
      description: `${pick(r.blurb)} ${material}; ${origin.charAt(0).toLowerCase()}${origin.slice(1)}.`,
      details: details(r, material, origin),
      care,
      images,
      tags,
      tone: mixHex(colourways[0].hex, "#EAE4D8", 0.5),
      createdAt: createdAt.toISOString().slice(0, 10),
      popularity: Math.round(rand() * 100),
    });
  }
}

if (products.length !== 200) throw new Error(`Expected 200 products, generated ${products.length}`);

// Invariants that back the storefront's promises.
for (const p of products) {
  if (["heels", "ballerinas", "sandals", "boots", "dresses", "skirts", "blouses", "sarees"].includes(p.category) && p.department !== "women") throw new Error(`${p.slug}: ${p.category} must be women`);
  if (p.category === "boat-shoes" && p.department !== "men") throw new Error(`${p.slug}: boat shoes must be men`);
  if (new Set(p.images.map((i) => i.id)).size !== p.images.length) throw new Error(`${p.slug}: duplicate image`);
  if (p.variants.length === 0 || p.variants.some((v) => !v.image)) throw new Error(`${p.slug}: variant without image`);
}

const out = resolve(process.cwd(), "src/data/products.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(products, null, 2) + "\n");

const byCat = products.reduce<Record<string, number>>((acc, p) => ((acc[`${p.department}/${p.category}`] = (acc[`${p.department}/${p.category}`] ?? 0) + 1), acc), {});
console.log(`Wrote ${products.length} products → ${out}`);
console.log(Object.entries(byCat).map(([k, v]) => `${k}:${v}`).join("  "));
console.log(`${new Set(products.flatMap((p) => p.images.map((i) => i.id))).size} unique photos · ${EXCLUDED.size} excluded ids`);
