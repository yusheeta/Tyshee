import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  link,
  className,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  link?: { href: string; label: string };
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", align === "center" && "sm:flex-col sm:items-center text-center", className)}>
      <div>
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h2 className="display text-3xl sm:text-4xl lg:text-5xl">{title}</h2>
      </div>
      {link && (
        <Link href={link.href} className="eyebrow link-underline text-ink">
          {link.label}
        </Link>
      )}
    </div>
  );
}
