import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;

const DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS colour_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    season TEXT NOT NULL,
    undertone TEXT NOT NULL,
    depth TEXT NOT NULL,
    clarity TEXT NOT NULL,
    method TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL,
    provider TEXT NOT NULL,
    payment_ref TEXT,
    currency TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    shipping INTEGER NOT NULL,
    total INTEGER NOT NULL,
    shipping_name TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    created_at TEXT NOT NULL,
    paid_at TEXT,
    fx_rate REAL NOT NULL DEFAULT 1,
    base_total INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS orders_payment_ref_idx ON orders(payment_ref)`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    colour TEXT NOT NULL,
    size TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    image_id TEXT NOT NULL,
    image_crop TEXT NOT NULL,
    tone TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id)`,
  `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    email TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  )`,
];

declare global {
  var __tyshDb: { client: Client; db: Db; ready: Promise<void> } | undefined;
}

function connect() {
  const url = process.env.DATABASE_URL || "file:./data/tysh.db";
  if (url.startsWith("file:./data/")) {
    // Local SQLite lives in ./data (git-ignored). Statically scoped so the bundler does
    // not trace the whole project as a dependency of this call.
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
  }
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  const db = drizzle(client, { schema });
  const ready = (async () => {
    await client.execute("PRAGMA foreign_keys = ON");
    for (const stmt of DDL) await client.execute(stmt);
    // Additive migrations for databases created before a column existed.
    const cols = new Set((await client.execute("PRAGMA table_info(orders)")).rows.map((r) => String(r.name)));
    if (!cols.has("fx_rate")) await client.execute("ALTER TABLE orders ADD COLUMN fx_rate REAL NOT NULL DEFAULT 1");
    if (!cols.has("base_total")) await client.execute("ALTER TABLE orders ADD COLUMN base_total INTEGER");
  })();
  return { client, db, ready };
}

/**
 * Returns the shared Drizzle instance once the schema is guaranteed to exist.
 * Cached on globalThis so hot reloads in development do not open new connections.
 */
export async function getDb(): Promise<Db> {
  if (!globalThis.__tyshDb) globalThis.__tyshDb = connect();
  await globalThis.__tyshDb.ready;
  return globalThis.__tyshDb.db;
}

export { schema };
