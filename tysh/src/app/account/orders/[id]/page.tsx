import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductImage } from "@/components/image/ProductImage";
import { Container } from "@/components/ui/Container";
import { getCurrentUser } from "@/lib/auth/session";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { SIZES, WIDTHS } from "@/lib/images";
import { getOrder, parseAddress } from "@/lib/orders";
import type { CropStrategy } from "@/lib/types";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/account/orders/${id}`);
  const order = await getOrder(id);
  if (!order || order.userId !== user.id) notFound();
  const address = parseAddress(order.shippingAddress);

  return (
    <Container className="pt-14 lg:pt-20">
      <p className="eyebrow">
        <Link href="/account" className="link-underline">Account</Link> · <Link href="/account/orders" className="link-underline">Orders</Link> · {order.id}
      </p>
      <h1 className="display mt-3 text-5xl">Order {order.id}</h1>
      <p className="mt-3 text-sm text-stone">
        Placed {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · <span className="capitalize">{order.status}</span>
        {order.paidAt && ` · Paid ${new Date(order.paidAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
      </p>

      <div className="mt-12 grid gap-12 lg:grid-cols-12">
        <ul className="divide-y divide-line border-y border-line lg:col-span-7">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-5 py-5">
              <div className="w-20 shrink-0">
                <ProductImage image={{ id: i.imageId, alt: i.name, crop: i.imageCrop as CropStrategy }} tone={i.tone} sizes={SIZES.thumb} widths={[...WIDTHS.thumb]} quality={60} />
              </div>
              <div className="flex-1">
                <Link href={`/products/${i.slug}`} className="font-serif text-lg">{i.name}</Link>
                <p className="mt-0.5 text-xs text-stone">{i.colour} · Size {i.size} · Qty {i.qty}</p>
              </div>
              <p className="text-sm tabular-nums">{formatMoney(i.unitPrice * i.qty, order.currency as CurrencyCode)}</p>
            </li>
          ))}
        </ul>
        <div className="space-y-8 lg:col-span-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd className="tabular-nums">{formatMoney(order.subtotal, order.currency as CurrencyCode)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone">Shipping</dt><dd className="tabular-nums">{order.shipping ? formatMoney(order.shipping, order.currency as CurrencyCode) : "Complimentary"}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-base"><dt>Total</dt><dd className="tabular-nums">{formatMoney(order.total, order.currency as CurrencyCode)}</dd></div>
          </dl>
          <div className="text-sm">
            <p className="eyebrow">Shipping to</p>
            <address className="mt-2 not-italic leading-relaxed text-graphite">
              {address.name}<br />{address.line1}{address.line2 ? <><br />{address.line2}</> : null}<br />
              {address.city}{address.region ? `, ${address.region}` : ""} {address.postalCode}<br />{address.country}
            </address>
          </div>
        </div>
      </div>
    </Container>
  );
}
