import Link from "next/link";
import { NAV_COLLECTIONS } from "@/data/collections";
import { CartCount } from "@/components/cart/CartCount";
import { WishlistCount } from "@/components/cart/WishlistCount";
import { SearchIcon, UserIcon } from "@/components/ui/Icons";
import { CurrencySelector } from "./CurrencySelector";
import { ThemeToggle } from "./ThemeToggle";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";

const primary = [
  ...NAV_COLLECTIONS.map((c) => ({ href: `/collections/${c.slug}`, label: c.title })),
];
const secondary = [
  { href: "/journal", label: "Journal" },
  { href: "/colour-analysis", label: "Colour Analysis" },
  { href: "/about", label: "About" },
  { href: "/search", label: "Search" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/account", label: "Account" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between px-5 sm:px-8 lg:h-[4.5rem] lg:px-12">
        <div className="flex flex-1 items-center gap-8">
          <MobileMenu primary={[...primary, { href: "/journal", label: "Journal" }, { href: "/colour-analysis", label: "Colour Analysis" }]} secondary={secondary.slice(2)} />
          <nav className="hidden lg:block" aria-label="Primary">
            <ul className="flex items-center gap-6 whitespace-nowrap">
              {primary.map((i) => (
                <li key={i.href}>
                  <NavLink href={i.href} className="eyebrow text-ink">
                    {i.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Link href="/" className="font-serif text-[1.65rem] leading-none tracking-[0.32em] text-ink lg:text-3xl" aria-label="TYSHEE home">
          TYSHEE
        </Link>

        <div className="flex flex-1 items-center justify-end gap-5 lg:gap-6">
          <nav className="hidden xl:block" aria-label="Secondary">
            <ul className="flex items-center gap-6 whitespace-nowrap">
              <li>
                <NavLink href="/journal" className="eyebrow text-ink">Journal</NavLink>
              </li>
              <li>
                <NavLink href="/colour-analysis" className="eyebrow text-ink">Colour Analysis</NavLink>
              </li>
              <li>
                <CurrencySelector />
              </li>
            </ul>
          </nav>
          <Link href="/search" className="-m-2 flex h-10 w-10 items-center justify-center" aria-label="Search">
            <SearchIcon />
          </Link>
          <ThemeToggle />
          <WishlistCount className="-m-2 flex h-10 min-w-10 items-center justify-center gap-1 px-2" />
          <Link href="/account" className="-m-2 flex h-10 w-10 items-center justify-center" aria-label="Account">
            <UserIcon />
          </Link>
          <CartCount className="flex h-10 items-center gap-2" />
        </div>
      </div>
    </header>
  );
}
