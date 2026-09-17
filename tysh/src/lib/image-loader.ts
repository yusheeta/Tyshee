"use client";

import { buildImageUrl, type ImageUrlParams } from "@/lib/image-url";

/**
 * Custom next/image loader (next.config.ts → images.loaderFile).
 *
 * Called once per srcset candidate width. Delegates to the shared URL builder so the
 * exact same URLs are produced on the server (OG images, JSON-LD) and in the browser.
 * See src/lib/image-url.ts for the delivery modes (direct imgix, Cloudflare, mock).
 */
export default function imageLoader(params: ImageUrlParams): string {
  return buildImageUrl(params);
}
