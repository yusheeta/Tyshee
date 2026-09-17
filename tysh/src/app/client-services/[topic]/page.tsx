import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";

const TOPICS: Record<string, { title: string; sections: { h: string; p: string }[] }> = {
  shipping: {
    title: "Shipping",
    sections: [
      { h: "Free over $75", p: "Standard shipping is free on orders over $75. Below that, a flat $7.90 applies. Orders placed before 2pm ship the same working day." },
      { h: "Delivery times", p: "United States and Europe: 2–4 working days. Rest of world: 4–7 working days. Duties and taxes are included in the price shown at checkout." },
      { h: "Tracking", p: "You will receive a tracking link by email the moment your order leaves the atelier." },
    ],
  },
  returns: {
    title: "Returns & Exchanges",
    sections: [
      { h: "Thirty days", p: "Return or exchange any unworn piece with tags attached within thirty days of delivery. Returns are complimentary." },
      { h: "How", p: "Sign in to your account, open the order and request a return. A prepaid label is emailed to you. Refunds are issued within five working days of receipt." },
      { h: "Exceptions", p: "Fragrance, body oil and pierced jewellery cannot be returned once opened, for hygiene reasons." },
    ],
  },
  "size-guide": {
    title: "Size Guide",
    sections: [
      { h: "Women's ready-to-wear", p: "XS: UK 6 / US 2 / IT 38. S: UK 8 / US 4 / IT 40. M: UK 10 / US 6 / IT 42. L: UK 12 / US 8 / IT 44. XL: UK 14 / US 10 / IT 46. Our fit is cut generously; if between sizes, take the smaller." },
      { h: "Men's tailoring", p: "IT 44 = UK/US 34. IT 46 = 36. IT 48 = 38. IT 50 = 40. IT 52 = 42. IT 54 = 44. Knitwear runs XS–XL and is cut for an easy fit." },
      { h: "Footwear", p: "Our shoes are made in Italian sizes and fit true to size. EU 36 = UK 3 / US 6 (women). EU 42 = UK 8 / US 9 (men). Loafers may feel snug at first and will give with wear." },
    ],
  },
  care: {
    title: "Product Care",
    sections: [
      { h: "Cashmere", p: "Hand wash cold with cashmere shampoo, press out the water, dry flat. Store folded with cedar. Pilling in the first weeks is natural; remove gently with a cashmere comb." },
      { h: "Leather", p: "Keep dry. If wet, let it dry naturally away from heat. Condition twice a year with a neutral cream. Store in the dust bag, stuffed with tissue." },
      { h: "Tailoring and coats", p: "Specialist dry clean only, as rarely as possible. Steam rather than iron. Store on a wide, shaped hanger with room to breathe." },
    ],
  },
  contact: {
    title: "Contact",
    sections: [
      { h: "Client services", p: "Monday to Saturday, 9am to 7pm CET. Write to clientservices@tyshee.example and we will reply within one working day." },
      { h: "Appointments", p: "Private appointments, including in-person colour analysis, are available in our Seoul and Copenhagen ateliers." },
      { h: "Press", p: "press@tyshee.example" },
    ],
  },
  privacy: {
    title: "Privacy",
    sections: [
      { h: "What we collect", p: "Your account details, order history and, if you choose, a colour profile. Payment details are handled by our payment provider and never touch our servers." },
      { h: "Colour analysis", p: "Photos used for colour analysis are processed entirely in your browser and are never uploaded, stored or transmitted. Only the resulting season and traits are saved, on your device and, if you are signed in, to your account." },
      { h: "Your rights", p: "You may request a copy or deletion of your data at any time by writing to privacy@tyshee.example." },
    ],
  },
  terms: {
    title: "Terms",
    sections: [
      { h: "Orders", p: "An order is accepted when we send a confirmation email. Prices are shown in your selected currency and include duties and taxes; the amount charged is the amount shown at checkout." },
      { h: "Payment", p: "We accept major cards through our secure payment provider. Card details are handled by the provider and never stored on our servers." },
      { h: "Photography", p: "Editorial photography is used under licence from Unsplash contributors." },
    ],
  },
};

type Params = { topic: string };

export function generateStaticParams(): Params[] {
  return Object.keys(TOPICS).map((topic) => ({ topic }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { topic } = await params;
  const t = TOPICS[topic];
  return t ? { title: t.title } : {};
}

export default async function ClientServicePage({ params }: { params: Promise<Params> }) {
  const { topic } = await params;
  const t = TOPICS[topic];
  if (!t) notFound();
  return (
    <Container className="pt-14 lg:pt-20">
      <div className="grid gap-12 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <p className="eyebrow">Client services</p>
          <ul className="mt-5 space-y-3 text-sm">
            {Object.entries(TOPICS).map(([slug, x]) => (
              <li key={slug}>
                <Link href={`/client-services/${slug}`} className={slug === topic ? "text-ink" : "link-underline text-stone"} aria-current={slug === topic ? "page" : undefined}>
                  {x.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
        <div className="lg:col-span-7">
          <h1 className="display text-5xl sm:text-6xl">{t.title}</h1>
          <dl className="mt-12 divide-y divide-line">
            {t.sections.map((s) => (
              <div key={s.h} className="grid gap-3 py-7 sm:grid-cols-3">
                <dt className="font-serif text-xl">{s.h}</dt>
                <dd className="text-[15px] leading-relaxed text-graphite sm:col-span-2">{s.p}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Container>
  );
}
