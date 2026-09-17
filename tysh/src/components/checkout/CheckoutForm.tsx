"use client";

import Link from "next/link";
import { useState } from "react";
import { ProductImage } from "@/components/image/ProductImage";
import { cartTotals, useCart } from "@/lib/cart-store";
import { useMoney } from "@/lib/currency-store";
import { SIZES, WIDTHS } from "@/lib/images";

const COUNTRIES = [
  ["US", "United States"], ["GB", "United Kingdom"], ["DK", "Denmark"], ["DE", "Germany"], ["FR", "France"], ["IT", "Italy"], ["ES", "Spain"], ["NL", "Netherlands"],
  ["SE", "Sweden"], ["KR", "South Korea"], ["JP", "Japan"], ["IN", "India"], ["AE", "United Arab Emirates"], ["SG", "Singapore"], ["AU", "Australia"], ["CA", "Canada"],
];

export function CheckoutForm({ defaultEmail, stripeMode, cancelled }: { defaultEmail: string; stripeMode: boolean; cancelled: boolean }) {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const { subtotal, shipping, total } = cartTotals(items);
  const { currency, format } = useMoney();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(cancelled ? "Payment was cancelled. Your bag is unchanged." : null);

  if (!hydrated) return <div className="mt-12 h-64 animate-pulse bg-bone" aria-busy="true" />;
  if (!items.length) {
    return (
      <div className="mt-12">
        <p className="font-serif text-2xl">There is nothing to check out yet.</p>
        <Link href="/collections/all" className="btn btn-ghost mt-6">
          Browse the collection
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      email: fd.get("email"),
      address: {
        name: fd.get("name"),
        line1: fd.get("line1"),
        line2: fd.get("line2") || "",
        city: fd.get("city"),
        region: fd.get("region") || "",
        postalCode: fd.get("postalCode"),
        country: fd.get("country"),
      },
      lines: items.map((i) => ({ productId: i.productId, colour: i.colour, size: i.size, qty: i.qty })),
      currency,
    };
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Something went wrong. Please try again.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-16" noValidate={false}>
      <div className="space-y-12 lg:col-span-7">
        <fieldset>
          <legend className="eyebrow">Contact</legend>
          <div className="mt-5">
            <label htmlFor="email" className="sr-only">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" defaultValue={defaultEmail} placeholder="Email address" className="field" />
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow">Shipping address</legend>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="sr-only">Full name</label>
              <input id="name" name="name" required autoComplete="name" placeholder="Full name" className="field" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="line1" className="sr-only">Address</label>
              <input id="line1" name="line1" required autoComplete="address-line1" placeholder="Address" className="field" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="line2" className="sr-only">Apartment, suite</label>
              <input id="line2" name="line2" autoComplete="address-line2" placeholder="Apartment, suite (optional)" className="field" />
            </div>
            <div>
              <label htmlFor="city" className="sr-only">City</label>
              <input id="city" name="city" required autoComplete="address-level2" placeholder="City" className="field" />
            </div>
            <div>
              <label htmlFor="region" className="sr-only">State / Region</label>
              <input id="region" name="region" autoComplete="address-level1" placeholder="State / Region" className="field" />
            </div>
            <div>
              <label htmlFor="postalCode" className="sr-only">Postal code</label>
              <input id="postalCode" name="postalCode" required autoComplete="postal-code" placeholder="Postal code" className="field" />
            </div>
            <div>
              <label htmlFor="country" className="sr-only">Country</label>
              <select id="country" name="country" required autoComplete="country" defaultValue="US" className="field">
                {COUNTRIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <div>
          <p className="eyebrow">Payment</p>
          <p className="mt-4 text-sm leading-relaxed text-graphite">
            {stripeMode
              ? `You will be charged ${format(total)} in ${currency} through our secure card checkout.`
              : `You will be charged ${format(total)} in ${currency}. Enter your card details on the next step.`}
          </p>
        </div>

        {error && (
          <p className="text-sm text-oxblood" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn w-full sm:w-auto">
          {pending ? "Preparing payment…" : stripeMode ? `Pay ${format(total)} with Stripe` : `Continue to payment · ${format(total)}`}
        </button>
      </div>

      <aside className="lg:col-span-5">
        <div className="border border-line p-6 sm:p-8 lg:sticky lg:top-28">
          <p className="eyebrow">Your bag</p>
          <ul className="mt-6 divide-y divide-line">
            {items.map((i) => (
              <li key={i.key} className="flex gap-4 py-4">
                <div className="w-16 shrink-0">
                  <ProductImage image={i.image} tone={i.tone} sizes={SIZES.thumb} widths={[...WIDTHS.thumb]} quality={60} />
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-serif text-base leading-snug">{i.name}</p>
                  <p className="mt-0.5 text-xs text-stone">
                    {i.colour} · {i.size} · Qty {i.qty}
                  </p>
                </div>
                <p className="text-sm tabular-nums">{format(i.price * i.qty)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd className="tabular-nums">{format(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone">Shipping</dt><dd className="tabular-nums">{shipping ? format(shipping) : "Complimentary"}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-base"><dt>Total</dt><dd className="tabular-nums">{format(total)}</dd></div>
          </dl>
        </div>
      </aside>
    </form>
  );
}
