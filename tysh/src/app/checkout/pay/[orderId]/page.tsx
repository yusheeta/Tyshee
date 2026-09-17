import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TestCardForm } from "@/components/checkout/TestCardForm";
import { Container } from "@/components/ui/Container";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { getOrder } from "@/lib/orders";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default async function TestPayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await getOrder(orderId);
  if (!order || order.provider !== "test") notFound();
  if (order.status === "paid") redirect(`/checkout/success?order=${order.id}`);

  return (
    <Container className="pt-14 lg:pt-20">
      <div className="mx-auto max-w-lg">
        <p className="eyebrow">Secure payment</p>
        <h1 className="display mt-3 text-5xl">Card details</h1>
        <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
          {order.items.map((i) => (
            <div key={i.id} className="flex justify-between py-3">
              <dt className="text-graphite">
                {i.name} <span className="text-stone">· {i.colour} · {i.size} × {i.qty}</span>
              </dt>
              <dd className="tabular-nums">{formatMoney(i.unitPrice * i.qty, order.currency as CurrencyCode)}</dd>
            </div>
          ))}
          <div className="flex justify-between py-3">
            <dt className="text-stone">Shipping</dt>
            <dd className="tabular-nums">{order.shipping ? formatMoney(order.shipping, order.currency as CurrencyCode) : "Complimentary"}</dd>
          </div>
          <div className="flex justify-between py-3 text-base">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(order.total, order.currency as CurrencyCode)}</dd>
          </div>
        </dl>
        <TestCardForm orderId={order.id} total={order.total} currency={order.currency as CurrencyCode} />
      </div>
    </Container>
  );
}
