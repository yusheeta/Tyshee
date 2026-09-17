import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const colourProfiles = sqliteTable("colour_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  season: text("season").notNull(),
  undertone: text("undertone").notNull(),
  depth: text("depth").notNull(),
  clarity: text("clarity").notNull(),
  method: text("method").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  status: text("status", { enum: ["pending", "paid", "cancelled"] }).notNull(),
  provider: text("provider", { enum: ["stripe", "test"] }).notNull(),
  paymentRef: text("payment_ref"),
  /** Currency the order was charged in; amounts below are minor units of this currency. */
  currency: text("currency").notNull(),
  subtotal: integer("subtotal").notNull(),
  shipping: integer("shipping").notNull(),
  total: integer("total").notNull(),
  /** Units of `currency` per 1 USD at the time of the order. */
  fxRate: real("fx_rate").notNull().default(1),
  /** Total in the base currency (USD cents) for reconciliation. */
  baseTotal: integer("base_total"),
  shippingName: text("shipping_name").notNull(),
  /** JSON-encoded address */
  shippingAddress: text("shipping_address").notNull(),
  createdAt: text("created_at").notNull(),
  paidAt: text("paid_at"),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  colour: text("colour").notNull(),
  size: text("size").notNull(),
  unitPrice: integer("unit_price").notNull(),
  qty: integer("qty").notNull(),
  imageId: text("image_id").notNull(),
  imageCrop: text("image_crop").notNull(),
  tone: text("tone").notNull(),
});

export const newsletterSubscribers = sqliteTable("newsletter_subscribers", {
  email: text("email").primaryKey(),
  createdAt: text("created_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type ColourProfileRow = typeof colourProfiles.$inferSelect;
