import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = { title: "Your Bag", robots: { index: false } };

export default function CartPage() {
  return (
    <Container className="pt-14 lg:pt-20">
      <p className="eyebrow">Shopping bag</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Your bag</h1>
      <CartView />
    </Container>
  );
}
