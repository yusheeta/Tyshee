import type { Metadata } from "next";
import { WishlistView } from "@/components/product/WishlistView";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function WishlistPage() {
  return (
    <Container className="pt-14 lg:pt-20">
      <p className="eyebrow">Saved pieces</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Your wishlist</h1>
      <WishlistView />
    </Container>
  );
}
