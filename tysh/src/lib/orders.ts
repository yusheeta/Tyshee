import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@/lib/db";
import { BASE_CURRENCY, convertMinor, STATIC_RATES, type CurrencyCode, type Rates } from "@/lib/currency";
import { MAX_QTY, shippingFor } from "@/lib/shipping";
import { getProductById } from "@/lib/products";
import type { Order, OrderItem } from "@/lib/db/schema";

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
}

export interface CartLine {
  productId: string;
  colour: string;
  size: string;
  qty: number;
}

export interface PricedLine {
  productId: string;
  slug: string;
  name: string;
  colour: string;
  size: string;
  /** Minor units of the order currency. */
  unitPrice: number;
  qty: number;
  imageId: string;
  imageCrop: string;
  tone: string;
}

export interface PricedOrder {
  currency: CurrencyCode;
  fxRate: number;
  lines: PricedLine[];
  subtotal: number;
  shipping: number;
  total: number;
  /** USD cents, for reconciliation. */
  baseTotal: number;
}

export class PricingError extends Error {}

/**
 * Never trust prices from the client: rebuild every line from the catalogue, then convert
 * each unit price into the checkout currency exactly as the storefront displayed it.
 */
export function priceLines(lines: CartLine[], currency: CurrencyCode = BASE_CURRENCY, rates?: Rates): PricedOrder {
  const base: number[] = [];
  const priced: PricedLine[] = lines.map((l) => {
    const p = getProductById(l.productId);
    if (!p) throw new PricingError(`Unknown product ${l.productId}`);
    const variant = p.variants.find((v) => v.name === l.colour);
    if (!variant) throw new PricingError(`${p.name} is not available in ${l.colour}`);
    if (!p.sizes.includes(l.size)) throw new PricingError(`${p.name} is not available in size ${l.size}`);
    const available = variant.sizeStock[l.size] ?? 0;
    if (available <= 0) throw new PricingError(`${p.name} in ${l.colour}, size ${l.size} is sold out`);
    const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(l.qty), available));
    base.push(p.price * qty);
    return {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      colour: l.colour,
      size: l.size,
      unitPrice: convertMinor(p.price, currency, rates),
      qty,
      imageId: variant.image.id,
      imageCrop: variant.image.crop,
      tone: p.tone,
    };
  });
  // Shipping rules are defined in USD; the free-shipping threshold is judged on the USD subtotal.
  const baseSubtotal = base.reduce((s, v) => s + v, 0);
  const baseShipping = shippingFor(baseSubtotal);
  const subtotal = priced.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const shipping = convertMinor(baseShipping, currency, rates);
  return {
    currency,
    fxRate: currency === BASE_CURRENCY ? 1 : (rates ?? STATIC_RATES)[currency],
    lines: priced,
    subtotal,
    shipping,
    total: subtotal + shipping,
    baseTotal: baseSubtotal + baseShipping,
  };
}

export async function createOrder(input: {
  email: string;
  userId: string | null;
  provider: "stripe" | "test";
  address: ShippingAddress;
} & PricedOrder): Promise<Order> {
  const db = await getDb();
  const id = `ord_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const now = new Date().toISOString();
  const order: Order = {
    id,
    userId: input.userId,
    email: input.email,
    status: "pending",
    provider: input.provider,
    paymentRef: null,
    currency: input.currency,
    subtotal: input.subtotal,
    shipping: input.shipping,
    total: input.total,
    fxRate: input.fxRate,
    baseTotal: input.baseTotal,
    shippingName: input.address.name,
    shippingAddress: JSON.stringify(input.address),
    createdAt: now,
    paidAt: null,
  };
  await db.insert(schema.orders).values(order);
  await db.insert(schema.orderItems).values(input.lines.map((l) => ({ orderId: id, ...l })));
  return order;
}

export async function setPaymentRef(orderId: string, ref: string): Promise<void> {
  const db = await getDb();
  await db.update(schema.orders).set({ paymentRef: ref }).where(eq(schema.orders.id, orderId));
}

export async function markOrderPaid(orderId: string, ref: string | null): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.orders)
    .set({ status: "paid", paidAt: new Date().toISOString(), ...(ref ? { paymentRef: ref } : {}) })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "pending")));
}

export async function markOrderCancelled(orderId: string): Promise<void> {
  const db = await getDb();
  await db.update(schema.orders).set({ status: "cancelled" }).where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "pending")));
}

export async function getOrder(orderId: string): Promise<(Order & { items: OrderItem[] }) | null> {
  const db = await getDb();
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!order) return null;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  return { ...order, items };
}

export async function getOrdersForUser(userId: string): Promise<(Order & { items: OrderItem[] })[]> {
  const db = await getDb();
  const list = await db.select().from(schema.orders).where(eq(schema.orders.userId, userId)).orderBy(desc(schema.orders.createdAt));
  const out = [];
  for (const o of list) {
    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id));
    out.push({ ...o, items });
  }
  return out;
}

export function parseAddress(json: string): ShippingAddress {
  try {
    return JSON.parse(json) as ShippingAddress;
  } catch {
    return { name: "", line1: "", city: "", postalCode: "", country: "" };
  }
}
