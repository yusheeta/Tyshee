import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({
  children,
  className,
  as: Tag = "div",
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  wide?: boolean;
}) {
  return (
    <Tag className={cn("mx-auto w-full px-5 sm:px-8 lg:px-12", wide ? "max-w-[1680px]" : "max-w-[1440px]", className)}>
      {children}
    </Tag>
  );
}
