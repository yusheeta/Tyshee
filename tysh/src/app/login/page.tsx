import type { Metadata } from "next";
import { AuthForm } from "@/components/account/AuthForm";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/account" } = await searchParams;
  return (
    <Container className="pt-14 lg:pt-20">
      <div className="mx-auto max-w-md">
        <p className="eyebrow">Account</p>
        <h1 className="display mt-3 text-5xl">Sign in</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone">Your orders, your colour season, your addresses.</p>
        <AuthForm mode="login" next={next.startsWith("/") ? next : "/account"} />
      </div>
    </Container>
  );
}
