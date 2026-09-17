/** Shared by the client-side loader and server components. No directives here. */
export const DEFAULT_IMAGE_ORIGIN = "https://images.unsplash.com";

export const IMAGE_ORIGIN = (process.env.NEXT_PUBLIC_IMAGE_ORIGIN || DEFAULT_IMAGE_ORIGIN).replace(/\/$/, "");

export const IMAGE_CDN_MODE = process.env.NEXT_PUBLIC_IMAGE_CDN || "direct";
