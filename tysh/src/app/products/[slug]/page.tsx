import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductView } from "@/components/product/ProductView";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { photoSrc } from "@/lib/images";
import { getAllProducts, getProductBySlug, getRelatedProducts } from "@/lib/products";
import { collectionForProduct, collectionTrail } from "@/data/collections";
import { SITE_URL } from "@/lib/utils";
import { buildImageUrl } from "@/lib/image-url";

export const revalidate = 3600;
// Every product is pre-rendered at build; unknown slugs return a real 404 status.
export const dynamicParams = false;

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getAllProducts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  const og = buildImageUrl({ src: photoSrc(product.images[0].id, { ar: "1:1", crop: product.images[0].crop }), width: 1200, quality: 75 });
  return {
    title: `${product.brand} ${product.name}`,
    description: product.description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: `${product.brand} ${product.name}`, description: product.description, images: [{ url: og, width: 1200, height: 1200, alt: product.images[0].alt }] },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();
  const related = getRelatedProducts(product, 4);
  const trail = collectionTrail(collectionForProduct(product));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.id,
    brand: { "@type": "Brand", name: product.brand },
    image: product.images.map((i) => buildImageUrl({ src: photoSrc(i.id, { ar: "3:4", crop: i.crop }), width: 1200, quality: 75 })),
    color: product.variants.map((c) => c.name).join(", "),
    material: product.materials,
    offers: {
      "@type": "Offer",
      itemCondition: "https://schema.org/NewCondition",
      availability: product.variants.some((v) => Object.values(v.sizeStock).some((n) => n > 0)) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${SITE_URL}/products/${product.slug}`,
      priceCurrency: "USD",
      price: (product.price / 100).toFixed(2),
    },
  };

  return (
    <>
      <Container className="pt-6 lg:pt-8">
        <nav aria-label="Breadcrumb" className="eyebrow flex flex-wrap items-center gap-2 !normal-case !tracking-normal text-xs">
          <Link href="/" className="link-underline text-stone">Home</Link>
          {trail.map((c) => (
            <span key={c.slug} className="contents">
              <span aria-hidden="true">/</span>
              <Link href={`/collections/${c.slug}`} className="link-underline text-stone">{c.title}</Link>
            </span>
          ))}
          <span aria-hidden="true">/</span>
          <span className="text-ink">{product.name}</span>
        </nav>
      </Container>

      <Container className="mt-6 lg:mt-8">
        <ProductView product={product}>
          <div className="mt-10 divide-y divide-line border-y border-line">
            <details className="group py-4" open>
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm">
                Description <span className="text-stone transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-graphite">{product.description}</p>
            </details>
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm">
                Material &amp; care <span className="text-stone transition group-open:rotate-45">+</span>
              </summary>
              <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-graphite">
                {product.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
                <li className="pt-2 text-stone">{product.care}</li>
              </ul>
            </details>
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm">
                Shipping &amp; returns <span className="text-stone transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-graphite">
                Free standard shipping on orders over $75; otherwise $7.90. Delivered in 2–4 working days. Returns and exchanges accepted within 30 days
                of delivery, unworn with tags attached.
              </p>
            </details>
          </div>
        </ProductView>
      </Container>

      {related.length > 0 && (
        <Container className="mt-24 lg:mt-32">
          <SectionHeading eyebrow="Complete the look" title="You may also like" className="mb-12" />
          <ProductGrid products={related} />
        </Container>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
