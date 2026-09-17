import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { SeasonSwatches } from "@/components/colour/SeasonSwatches";
import { Container } from "@/components/ui/Container";
import { logout } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getSeason } from "@/lib/colour/seasons";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { getDb, schema } from "@/lib/db";
import { getOrdersForUser } from "@/lib/orders";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const db = await getDb();
  const [[profile], orders] = await Promise.all([
    db.select().from(schema.colourProfiles).where(eq(schema.colourProfiles.userId, user.id)).limit(1),
    getOrdersForUser(user.id),
  ]);
  const season = getSeason(profile?.season);

  return (
    <Container className="pt-14 lg:pt-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="display mt-3 text-5xl sm:text-6xl">Good to see you, {user.name.split(" ")[0]}.</h1>
          <p className="mt-3 text-sm text-stone">{user.email}</p>
        </div>
        <form action={logout}>
          <button type="submit" className="btn btn-ghost">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-16 grid gap-12 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl">Recent orders</h2>
            {orders.length > 0 && (
              <Link href="/account/orders" className="eyebrow link-underline text-ink">
                All orders
              </Link>
            )}
          </div>
          {orders.length === 0 ? (
            <p className="mt-6 text-sm text-stone">No orders yet.</p>
          ) : (
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {orders.slice(0, 5).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                  <div>
                    <Link href={`/account/orders/${o.id}`} className="link-underline">
                      {o.id}
                    </Link>
                    <p className="mt-0.5 text-xs text-stone">
                      {new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {o.items.reduce((s, i) => s + i.qty, 0)} items ·{" "}
                      <span className="capitalize">{o.status}</span>
                    </p>
                  </div>
                  <p className="tabular-nums">{formatMoney(o.total, o.currency as CurrencyCode)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-5">
          <h2 className="font-serif text-2xl">Your colour season</h2>
          {season ? (
            <div className="mt-6 border border-line p-6">
              <SeasonSwatches season={season} className="h-10" />
              <p className="font-serif mt-4 text-2xl">{season.label}</p>
              <p className="text-sm italic text-graphite">{season.tagline}</p>
              <p className="mt-3 text-xs text-stone">
                <span className="capitalize">{profile.undertone}</span> · <span className="capitalize">{profile.depth}</span> · <span className="capitalize">{profile.clarity}</span> · by {profile.method}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/collections/all?season=${season.id}`} className="btn">
                  Shop my palette
                </Link>
                <Link href="/colour-analysis" className="btn btn-ghost">
                  Re-analyse
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 border border-line p-6">
              <p className="text-sm leading-relaxed text-graphite">You have not saved a colour season to this account yet. It takes a minute and runs in your browser.</p>
              <Link href="/colour-analysis" className="btn mt-5">
                Find my season
              </Link>
            </div>
          )}
        </section>
      </div>
    </Container>
  );
}
