import type { Metadata } from "next";
import { AuthForm } from "@/components/account/AuthForm";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/account" } = await searchParams;
  return (
    <Container className="pt-14 lg:pt-20">
      <div className="mx-auto max-w-md">
        <p className="eyebrow">Account</p>
        <h1 className="display mt-3 text-5xl">Create an account</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone">Keep your colour season and order history across devices.</p>
        <AuthForm mode="register" next={next.startsWith("/") ? next : "/account"} />
      </div>
    </Container>
  );
}
