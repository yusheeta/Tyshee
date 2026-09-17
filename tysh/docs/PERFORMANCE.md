# Image & page performance notes

Luxury storefronts are image-heavy by definition, so most of the engineering effort in
TYSHEE went into how images are requested, sized, prioritised and cached. This is the
checklist of what is implemented and where.

## Delivery

- **One URL builder** (`src/lib/image-url.ts`). Every `srcset` candidate is a fully
  qualified imgix URL with `w`, `h`, `q`, `fit=crop` and `auto=format`. The browser talks
  straight to the CDN; the Next server never proxies a pixel. The same builder feeds Open
  Graph tags, JSON-LD and Stripe thumbnails, and is exposed as a `next/image` loader
  (`src/lib/image-loader.ts`) for any ad-hoc `<Image>` usage.
- **Server-rendered `<img srcset>` instead of `next/image` for catalogue and editorial
  photography** (`src/components/image/ResponsiveImage.tsx`). `next/image` renders a client
  component per image; on a 24-card grid that is 24 hydrated components whose 12-candidate
  srcsets are serialised into both the HTML and the RSC payload. On a throttled phone the
  parse + hydration cost more than the pictures. The plain component emits identical
  responsive markup (srcset, sizes, lazy loading, fetch priority, intrinsic dimensions,
  first-frame placeholder) with zero client JS, tailors the candidate list to the slot, and
  preloads the LCP image through React Float. Together with the priority and prefetch
  changes below, the collection page went from 83 → 92 on the mobile profile and Total
  Blocking Time from 170 ms → 49 ms, with the same catalogue and the same photographs.
- **DPR-aware quality** (`adaptiveQuality`): candidates ≥ 1100 px are only ever chosen by
  2–3× screens, where artefacts are invisible, so quality steps down (75 → 62 → 55) as width
  grows. Large-screen bytes fall by roughly a third with no visible cost.
- **Format negotiation** via `auto=format`: AVIF/WebP for browsers that accept them, JPEG
  otherwise. No `<picture>` markup, no per-format URLs.
- **Aspect-ratio crops at the edge**: cards are always 3:4, heroes 16:9 or 21:9. The
  virtual `ar` param becomes an imgix `h` + `fit=crop`, so the CDN crops before
  transfer and no bytes are wasted on cropped-away pixels.
- **Cloudflare-ready**: `NEXT_PUBLIC_IMAGE_CDN=cloudflare` switches the builder to
  `/cdn-cgi/image/…` transformations. See `docs/CDN.md`.

## Sizing

- Every slot declares an honest `sizes` attribute and a matching candidate list from
  `src/lib/images.ts` (`SIZES` / `WIDTHS`): grid cards `[320 … 1280]`, the PDP gallery
  `[480 … 1600]`, thumbnails at 1×/2×/3×. Slots without an explicit list derive one from
  their `sizes` string (`widthsForSizes`), clipped to what any viewport × DPR could select.
- **Art direction for heroes** (`ArtDirectedImage`): a `<picture>` with a portrait crop and
  its own srcset for phones and a landscape crop for larger screens, each preloaded behind
  a media query. A single landscape image in a tall mobile box would be scaled ~3× and mostly
  cropped away; this serves only the pixels that are shown.
- Per-context quality: LCP hero at `q=65` (large, soft photograph), grid images at `q=75`,
  thumbnails at `q=60`.

## Loading & priority

- **LCP image is preloaded**: the hero (home), the first gallery image (PDP) and the first
  two grid cards (PLP) render with `preload` + `loading="eager"` + `fetchPriority="high"`,
  which emits `<link rel="preload" as="image" imagesrcset imagesizes>` in `<head>`.
- **Everything else is lazy and explicitly low priority** (`loading="lazy"` +
  `fetchpriority="low"`), including grid cards, journal imagery, related products and the
  second/third PDP gallery frames. Chrome's lazy-load threshold still fetches images up to
  ~1250 px below the fold, so on a two-column grid a dozen card images start downloading
  during page load; marking them low keeps the hero first in the bandwidth queue.
- **Card links prefetch on hover, not on viewport entry** (`prefetch={false}`). A 24-card
  collection page would otherwise fire 24 route prefetches during load.
- **Hover images cost nothing until hovered**: the alternate product shot on cards is a CSS
  background applied only in the `:hover` rule, so it is never fetched on touch devices or
  for cards merely scrolled past. Rendering it as a second `<img>` would double image
  bytes on every grid.
- `<link rel="preconnect">` to the image origin in the root layout.

## Layout stability

- Every image sits in a fixed-aspect box (`aspect-[3/4]` etc.) so CLS is ~0 regardless of
  network timing.
- **Inline SVG gradient placeholders** in the product's dominant tone (~300 bytes as a
  data URI) paint on the first frame. They are generated at build time from catalogue data
  and passed straight to `placeholder`, avoiding the blur-filter wrapper.
- Fonts are self-hosted via `next/font` with `display: swap` and automatic fallback metric
  adjustment, so text does not reflow when the webfont lands. Only two font files ship
  (one serif, one sans, ~60 KB): every preloaded font competes with the LCP image on slow
  connections, so extra weights and italics were cut rather than loaded.

## Resilience

- A 300-byte inline script listens for `error` events on `<img>` in the capture phase and
  swaps in a branded SVG. A CDN hiccup never shows a broken-image glyph.
- `scripts/verify-images.mjs` HEAD-checks every photo id in CI.

## JavaScript & rendering

- App Router with React Server Components: product grids, PDP content, journal, filters
  and pagination are server-rendered with zero client JS. Client components are limited to
  the cart, purchase panel, colour analysis and small controls.
- The colour-analysis flow (canvas sampling, quiz) is `dynamic()`-imported and only
  downloaded when a visitor opens it.
- All 200 product pages and every collection landing are pre-rendered at build (SSG/ISR);
  filtered collection views render on demand from an in-memory catalogue in single-digit ms.
- Hashed static assets ship with `immutable` cache headers; HTML carries `s-maxage` for
  edge caching.

## Measuring

```bash
npm run lighthouse             # builds against the local imgix-compatible mock origin
npm run lighthouse -- --skip-build --origin=https://images.unsplash.com
```

Reports land in `lighthouse/` with a `SUMMARY.md` table. The mock origin exists because
Unsplash is not reachable from every CI sandbox: it answers the same `w/h/q/auto=format`
parameters with synthetic photographs whose encoded size matches a real `q=75`
photograph (≈ 77 KB for a 768×1024 WebP), so the lab run exercises the exact same request
pattern the production build does. Before auditing, the script requests every image variant
the pages reference so the origin answers from cache, which is the steady state of a CDN
edge. Lighthouse's Lantern model anchors its estimate on the observed LCP timestamp, so a
cold, slow origin would depress the score in a way a warm CDN never does. Numbers against
the real CDN depend mostly on the tester's distance from the nearest imgix edge.
