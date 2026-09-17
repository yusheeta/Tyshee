import "server-only";
import Stripe from "stripe";

let client: Stripe | null | undefined;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Lazily constructed Stripe client. `null` when the storefront runs on its test gateway. */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? new Stripe(key, { typescript: true }) : null;
  return client;
}
