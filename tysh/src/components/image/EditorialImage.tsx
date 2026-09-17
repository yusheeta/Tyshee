import { photoSrc, type AspectRatio } from "@/lib/images";
import type { CropStrategy } from "@/lib/types";
import { ResponsiveImage } from "./ResponsiveImage";

interface Props {
  id: string;
  alt: string;
  crop?: CropStrategy;
  sizes: string;
  widths?: number[];
  ar?: AspectRatio;
  preload?: boolean;
  quality?: number;
  tone?: string;
  className?: string;
  imgClassName?: string;
}

/** Editorial photograph (collections, journal, about). Server component. */
export function EditorialImage({ id, alt, crop = "entropy", sizes, widths, ar = "4:5", preload = false, quality = 75, tone = "#D8D1C4", className, imgClassName }: Props) {
  return (
    <ResponsiveImage
      src={photoSrc(id, { ar, crop })}
      alt={alt}
      sizes={sizes}
      widths={widths}
      ar={ar}
      quality={quality}
      preload={preload}
      tone={tone}
      className={className}
      imgClassName={imgClassName}
    />
  );
}
