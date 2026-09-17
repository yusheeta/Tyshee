import Link from "next/link";
import { COLLECTIONS } from "@/data/collections";
import { Container } from "@/components/ui/Container";
import { CurrencySelector } from "./CurrencySelector";
import { NewsletterForm } from "./NewsletterForm";

const shop = COLLECTIONS.filter((c) => ["women", "men", "shoes", "leather-goods", "jewellery", "accessories", "fragrance-and-objects", "new-arrivals"].includes(c.slug));

const services = [
  { href: "/client-services/shipping", label: "Shipping" },
  { href: "/client-services/returns", label: "Returns & Exchanges" },
  { href: "/client-services/size-guide", label: "Size Guide" },
  { href: "/client-services/care", label: "Product Care" },
  { href: "/client-services/contact", label: "Contact" },
];

const company = [
  { href: "/about", label: "About TYSHEE" },
  { href: "/journal", label: "Journal" },
  { href: "/colour-analysis", label: "Colour Analysis" },
  { href: "/client-services/privacy", label: "Privacy" },
  { href: "/client-services/terms", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-bone lg:mt-32">
      <Container className="grid gap-14 py-16 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-5">
          <NewsletterForm />
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7 lg:pl-12">
          <div>
            <p className="eyebrow">Shop</p>
            <ul className="mt-5 space-y-3 text-sm">
              {shop.map((c) => (
                <li key={c.slug}>
                  <Link href={`/collections/${c.slug}`} className="link-underline text-graphite">{c.title}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Client Services</p>
            <ul className="mt-5 space-y-3 text-sm">
              {services.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="link-underline text-graphite">{i.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Company</p>
            <ul className="mt-5 space-y-3 text-sm">
              {company.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="link-underline text-graphite">{i.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
      <div className="border-t border-line">
        <Container className="flex flex-col gap-3 py-6 text-xs text-stone sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 TYSHEE. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <CurrencySelector labelled />
            <p>Secure checkout · Complimentary returns</p>
          </div>
        </Container>
      </div>
    </footer>
  );
}
