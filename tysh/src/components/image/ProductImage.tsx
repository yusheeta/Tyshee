import { photoSrc, type AspectRatio } from "@/lib/images";
import type { ProductImage as ProductImageData } from "@/lib/types";
import { ResponsiveImage } from "./ResponsiveImage";

interface Props {
  image: ProductImageData;
  tone: string;
  /** `sizes` is mandatory: every grid declares its real rendered width. */
  sizes: string;
  widths?: number[];
  ar?: AspectRatio;
  preload?: boolean;
  lowPriority?: boolean;
  quality?: number;
  className?: string;
  imgClassName?: string;
}

/** Catalogue photograph in a fixed-aspect box with a tone placeholder. Server component. */
export function ProductImage({ image, tone, sizes, widths, ar = "3:4", preload = false, lowPriority = true, quality = 75, className, imgClassName }: Props) {
  return (
    <ResponsiveImage
      src={photoSrc(image.id, { ar, crop: image.crop })}
      alt={image.alt}
      sizes={sizes}
      widths={widths}
      ar={ar}
      quality={quality}
      preload={preload}
      lowPriority={lowPriority}
      tone={tone}
      className={className}
      imgClassName={imgClassName}
    />
  );
}
