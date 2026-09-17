import Link from "next/link";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  return (
    <Container className="py-32 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-4 text-5xl sm:text-6xl">This page has been folded away.</h1>
      <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-graphite">The piece you were looking for may have moved, or never existed. The collection, however, is right here.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/collections/all" className="btn">
          Browse the collection
        </Link>
        <Link href="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
    </Container>
  );
}
