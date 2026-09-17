import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { CartHydration } from "@/components/cart/CartHydration";
import { Toaster } from "@/components/ui/Toaster";
import { IMAGE_ORIGIN } from "@/lib/image-origin";
import { SITE_URL } from "@/lib/utils";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  // One file. Every font file is preloaded at high priority and competes with the LCP image
  // on slow connections, so the display face ships a single regular weight and the sans a
  // single weight too (~60 KB total instead of ~125 KB).
  weight: ["400"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "TYSHEE — Considered pieces, made slowly", template: "%s — TYSHEE" },
  description:
    "TYSHEE is a luxury house making coats, tailoring, knitwear, leather goods and jewellery with intention. Discover the collection and find your colour season.",
  applicationName: "TYSHEE",
  openGraph: { type: "website", siteName: "TYSHEE", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#fbfaf7",
  width: "device-width",
  initialScale: 1,
};

/**
 * Global <img> error fallback. Image error events do not bubble, but they can be
 * observed in the capture phase on `document`. When a CDN image fails we swap in a
 * branded SVG so the grid never shows a broken-image glyph. ~300 bytes, no hydration.
 */
/** Applies the saved theme before first paint so there is no flash of the wrong mode. */
const themeScript = `try{var t=localStorage.getItem('tysh-theme');if(t==='dark'||t==='night'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

const imgFallbackScript = `document.addEventListener('error',function(e){var t=e.target;if(!t||t.tagName!=='IMG'||t.dataset.fb)return;t.dataset.fb='1';t.removeAttribute('srcset');t.removeAttribute('sizes');t.src=t.dataset.placeholder||'/images/fallback.svg';t.classList.add('img-fallback');},true);`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${cormorant.variable} ${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href={IMAGE_ORIGIN} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={IMAGE_ORIGIN} />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        <CartHydration />
        <AnnouncementBar />
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <Toaster />
        <script dangerouslySetInnerHTML={{ __html: imgFallbackScript }} />
      </body>
    </html>
  );
}
