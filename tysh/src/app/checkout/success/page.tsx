import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearCart } from "@/components/checkout/ClearCart";
import { ProductImage } from "@/components/image/ProductImage";
import { Container } from "@/components/ui/Container";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { SIZES, WIDTHS } from "@/lib/images";
import { getOrder, markOrderPaid, parseAddress } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import type { CropStrategy } from "@/lib/types";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ order?: string; session_id?: string }> }) {
  const { order: orderId, session_id } = await searchParams;
  if (!orderId) notFound();
  let order = await getOrder(orderId);
  if (!order) notFound();

  // Without a webhook (e.g. local dev without the Stripe CLI) confirm the session directly.
  if (order.status === "pending" && order.provider === "stripe" && session_id) {
    const stripe = getStripe();
    if (stripe) {
      try {
        const s = await stripe.checkout.sessions.retrieve(session_id);
        if ((s.metadata?.orderId ?? s.client_reference_id) === order.id && s.payment_status === "paid") {
          await markOrderPaid(order.id, typeof s.payment_intent === "string" ? s.payment_intent : s.id);
          order = (await getOrder(orderId)) ?? order;
        }
      } catch (e) {
        console.error("[success] could not verify session", e);
      }
    }
  }

  const paid = order.status === "paid";
  const address = parseAddress(order.shippingAddress);

  return (
    <Container className="pt-14 lg:pt-20">
      {paid && <ClearCart />}
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">{paid ? "Order confirmed" : "Payment pending"}</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">{paid ? "Thank you." : "Almost there."}</h1>
        <p className="mt-6 text-[15px] leading-relaxed text-graphite">
          {paid
            ? `Your order ${order.id} is confirmed. A receipt has been sent to ${order.email}. We will write again when it leaves the atelier.`
            : `We are waiting for the payment provider to confirm order ${order.id}. Refresh in a moment; if the payment was cancelled, your bag is unchanged.`}
        </p>

        <ul className="mt-12 divide-y divide-line border-y border-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-5 py-5">
              <div className="w-20 shrink-0">
                <ProductImage image={{ id: i.imageId, alt: i.name, crop: i.imageCrop as CropStrategy }} tone={i.tone} sizes={SIZES.thumb} widths={[...WIDTHS.thumb]} quality={60} />
              </div>
              <div className="flex-1">
                <Link href={`/products/${i.slug}`} className="font-serif text-lg">
                  {i.name}
                </Link>
                <p className="mt-0.5 text-xs text-stone">
                  {i.colour} · Size {i.size} · Qty {i.qty}
                </p>
              </div>
              <p className="text-sm tabular-nums">{formatMoney(i.unitPrice * i.qty, order.currency as CurrencyCode)}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd className="tabular-nums">{formatMoney(order.subtotal, order.currency as CurrencyCode)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone">Shipping</dt><dd className="tabular-nums">{order.shipping ? formatMoney(order.shipping, order.currency as CurrencyCode) : "Complimentary"}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-base"><dt>Total</dt><dd className="tabular-nums">{formatMoney(order.total, order.currency as CurrencyCode)}</dd></div>
            <div className="flex justify-between pt-2 text-xs text-stone"><dt>Payment</dt><dd>Card {order.paymentRef ? `· ref ${order.paymentRef.slice(0, 18)}` : ""}</dd></div>
          </dl>
          <div className="text-sm">
            <p className="eyebrow">Shipping to</p>
            <address className="mt-2 not-italic leading-relaxed text-graphite">
              {address.name}<br />
              {address.line1}{address.line2 ? <><br />{address.line2}</> : null}<br />
              {address.city}{address.region ? `, ${address.region}` : ""} {address.postalCode}<br />
              {address.country}
            </address>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/account/orders" className="btn btn-ghost">
            View your orders
          </Link>
          <Link href="/collections/new-arrivals" className="btn">
            Continue shopping
          </Link>
        </div>
      </div>
    </Container>
  );
}
