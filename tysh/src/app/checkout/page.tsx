import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { Container } from "@/components/ui/Container";
import { getSession } from "@/lib/auth/session";
import { isStripeConfigured } from "@/lib/stripe";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const [{ cancelled }, session] = await Promise.all([searchParams, getSession()]);
  return (
    <Container className="pt-14 lg:pt-20">
      <p className="eyebrow">Checkout</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Almost yours</h1>
      <CheckoutForm defaultEmail={session?.email ?? ""} stripeMode={isStripeConfigured()} cancelled={cancelled === "1"} />
    </Container>
  );
}
