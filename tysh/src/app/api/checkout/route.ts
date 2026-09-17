import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { photoSrc } from "@/lib/images";
import { buildImageUrl } from "@/lib/image-url";
import { createOrder, priceLines, PricingError, setPaymentRef } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { BASE_CURRENCY, CURRENCY_CODES, CURRENCY_COOKIE, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { getRates } from "@/lib/rates";
import { cookies } from "next/headers";
import { SITE_URL } from "@/lib/utils";

const Body = z.object({
  email: z.string().trim().toLowerCase().email(),
  address: z.object({
    name: z.string().trim().min(2).max(80),
    line1: z.string().trim().min(3).max(120),
    line2: z.string().trim().max(120).optional().or(z.literal("")),
    city: z.string().trim().min(1).max(80),
    region: z.string().trim().max(80).optional().or(z.literal("")),
    postalCode: z.string().trim().min(2).max(20),
    country: z.string().trim().length(2),
  }),
  lines: z
    .array(z.object({ productId: z.string(), colour: z.string(), size: z.string(), qty: z.number().int().min(1).max(9) }))
    .min(1)
    .max(40),
  currency: z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]]).optional(),
});

/**
 * POST /api/checkout
 * Reprices the bag server-side, records a pending order, then either opens a Stripe
 * Checkout Session (test mode) or hands off to the built-in test gateway.
 */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const { email, address, lines } = parsed.data;
  // The bag's currency: explicit in the body, else the visitor's cookie, else the base.
  const cookieCurrency = (await cookies()).get(CURRENCY_COOKIE)?.value;
  const currency: CurrencyCode = parsed.data.currency ?? (isCurrencyCode(cookieCurrency) ? cookieCurrency : BASE_CURRENCY);
  const { rates } = await getRates();

  let priced;
  try {
    priced = priceLines(lines, currency, rates);
  } catch (e) {
    return NextResponse.json({ error: e instanceof PricingError ? e.message : "Could not price your bag." }, { status: 400 });
  }

  const session = await getSession();
  const stripe = getStripe();
  const order = await createOrder({
    email,
    userId: session?.sub ?? null,
    provider: stripe ? "stripe" : "test",
    address: { ...address, line2: address.line2 || undefined, region: address.region || undefined },
    ...priced,
  });

  if (!stripe) {
    return NextResponse.json({ url: `/checkout/pay/${order.id}`, mode: "test" });
  }

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      customer_email: email,
      metadata: { orderId: order.id },
      line_items: [
        ...priced.lines.map((l) => ({
          quantity: l.qty,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: l.unitPrice,
            product_data: {
              name: l.name,
              description: `${l.colour} · Size ${l.size}`,
              images: [buildImageUrl({ src: photoSrc(l.imageId, { ar: "1:1", crop: l.imageCrop as "entropy" }), width: 640, quality: 75 })],
              metadata: { productId: l.productId },
            },
          },
        })),
        ...(priced.shipping > 0
          ? [{ quantity: 1, price_data: { currency: order.currency.toLowerCase(), unit_amount: priced.shipping, product_data: { name: "Express shipping" } } }]
          : []),
      ],
      success_url: `${SITE_URL}/checkout/success?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/checkout?cancelled=1`,
    });
    await setPaymentRef(order.id, checkout.id);
    return NextResponse.json({ url: checkout.url, mode: "stripe" });
  } catch (e) {
    console.error("[checkout] stripe error", e);
    return NextResponse.json({ error: "Our payment provider could not be reached. Please try again." }, { status: 502 });
  }
}
