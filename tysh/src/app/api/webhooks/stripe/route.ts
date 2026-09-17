import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { markOrderCancelled, markOrderPaid } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";

/**
 * POST /api/webhooks/stripe
 * Fulfils orders when Stripe confirms payment. Locally: `stripe listen --forward-to
 * localhost:3000/api/webhooks/stripe` and set STRIPE_WEBHOOK_SECRET to the printed secret.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Stripe is not configured." }, { status: 501 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    const orderId = s.metadata?.orderId ?? s.client_reference_id;
    if (orderId && s.payment_status === "paid") await markOrderPaid(orderId, typeof s.payment_intent === "string" ? s.payment_intent : s.id);
  }
  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const s = event.data.object;
    const orderId = s.metadata?.orderId ?? s.client_reference_id;
    if (orderId) await markOrderCancelled(orderId);
  }

  return NextResponse.json({ received: true });
}
