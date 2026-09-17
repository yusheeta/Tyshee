import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";
import { acceptLanguageToCurrency, countryToCurrency, CURRENCY_COOKIE, CURRENCY_MODE_COOKIE, isCurrencyCode } from "@/lib/currency";

/**
 * Runs before rendering on every page request.
 *  - Currency: on a first visit, detect the country from the platform's geo header
 *    (Vercel, Cloudflare) or Accept-Language and set a currency cookie in "auto" mode.
 *    An existing cookie, especially one set manually by the selector, is never touched.
 *  - Auth: account pages require a valid session; signed-in visitors skip login/register.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let response: NextResponse | null = null;

  if (pathname.startsWith("/account") || pathname === "/login" || pathname === "/register") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;
    if (pathname.startsWith("/account") && !session) {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", pathname + search);
      response = NextResponse.redirect(url);
      if (token) response.cookies.delete(SESSION_COOKIE);
    } else if ((pathname === "/login" || pathname === "/register") && session) {
      const next = request.nextUrl.searchParams.get("next");
      response = NextResponse.redirect(new URL(next && next.startsWith("/") ? next : "/account", request.url));
    }
  }

  response ??= NextResponse.next();

  const existing = request.cookies.get(CURRENCY_COOKIE)?.value;
  if (!isCurrencyCode(existing)) {
    const country =
      request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? request.headers.get("x-country-code") ?? null;
    const currency = country ? countryToCurrency(country) : acceptLanguageToCurrency(request.headers.get("accept-language"));
    const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
    response.cookies.set(CURRENCY_COOKIE, currency, opts);
    response.cookies.set(CURRENCY_MODE_COOKIE, "auto", opts);
  }

  return response;
}

export const config = {
  // Every page, but not static assets or API routes.
  matcher: ["/((?!_next/static|_next/image|images/|fonts/|favicon.ico|robots.txt|sitemap.xml|opengraph-image|api/).*)"],
};
