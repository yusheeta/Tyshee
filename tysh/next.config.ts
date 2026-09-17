import type { NextConfig } from "next";

/**
 * TYSHEE storefront configuration.
 *
 * Image strategy
 * --------------
 * Product and editorial photography is served straight from Unsplash's imgix-backed
 * CDN through a custom loader (src/lib/image-loader.ts). The loader emits width,
 * quality, aspect-ratio crop and `auto=format` parameters so the browser receives an
 * AVIF/WebP at exactly the rendered size, cached at the CDN edge. Nothing is proxied
 * through the Next.js server, which keeps TTFB low and origin bandwidth at zero.
 *
 * `deviceSizes` / `imageSizes` are the candidate widths written into every `srcset`.
 * They are tuned to the storefront's real breakpoints so the browser never downloads
 * an image more than one step larger than it renders.
 *
 * Caching: Next already serves `/_next/static/*` with `public, max-age=31536000,
 * immutable`; the headers below cover the few assets in /public and add security
 * headers everywhere.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    qualities: [55, 65, 75, 85],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        // Camera is allowed on the same origin for the in-browser colour analysis.
        value: "camera=(self), microphone=(), geolocation=()",
      },
    ];
    return [
      { source: "/:path*", headers: security },
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
