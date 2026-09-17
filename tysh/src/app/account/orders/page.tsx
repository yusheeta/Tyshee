import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getCurrentUser } from "@/lib/auth/session";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { getOrdersForUser } from "@/lib/orders";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/orders");
  const orders = await getOrdersForUser(user.id);
  return (
    <Container className="pt-14 lg:pt-20">
      <p className="eyebrow">
        <Link href="/account" className="link-underline">Account</Link> · Orders
      </p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Your orders</h1>
      {orders.length === 0 ? (
        <p className="mt-10 text-sm text-stone">No orders yet.</p>
      ) : (
        <ul className="mt-12 divide-y divide-line border-y border-line">
          {orders.map((o) => (
            <li key={o.id} className="grid gap-3 py-6 sm:grid-cols-12 sm:items-center">
              <div className="sm:col-span-5">
                <Link href={`/account/orders/${o.id}`} className="font-serif text-lg link-underline">
                  {o.id}
                </Link>
                <p className="mt-1 text-xs text-stone">{new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <p className="text-sm text-graphite sm:col-span-4">{o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</p>
              <p className="text-sm sm:col-span-2 sm:text-right"><span className="eyebrow">{o.status}</span></p>
              <p className="text-sm tabular-nums sm:col-span-1 sm:text-right">{formatMoney(o.total, o.currency as CurrencyCode)}</p>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
