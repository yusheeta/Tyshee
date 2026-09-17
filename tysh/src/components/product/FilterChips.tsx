import Link from "next/link";
import type { Facets } from "@/lib/products";
import { CATEGORY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface PlpParams {
  sort?: string;
  colour?: string;
  size?: string;
  department?: string;
  category?: string;
  season?: string;
  page?: string;
}

export function hrefWith(base: string, params: PlpParams, changes: Partial<PlpParams>): string {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...params, ...changes })) if (v) next[k] = v;
  delete next.page;
  const qs = new URLSearchParams(next).toString();
  return qs ? `${base}?${qs}` : base;
}

function Chip({ href, active, children, swatch }: { href: string; active: boolean; children: React.ReactNode; swatch?: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn("inline-flex h-9 items-center gap-2 border px-3 text-xs transition", active ? "border-ink bg-ink text-paper" : "border-line text-graphite hover:border-ink")}
    >
      {swatch && <span className="h-3 w-3 rounded-full ring-1 ring-ink/15" style={{ backgroundColor: swatch }} aria-hidden="true" />}
      {children}
    </Link>
  );
}

export function FilterChips({ base, params, facets, showDepartments, showCategories }: { base: string; params: PlpParams; facets: Facets; showDepartments: boolean; showCategories: boolean }) {
  return (
    <div className="space-y-4">
      {showDepartments && facets.departments.length > 1 && (
        <Row label="For">
          {facets.departments.map((d) => (
            <Chip key={d} href={hrefWith(base, params, { department: params.department === d ? undefined : d })} active={params.department === d}>
              <span className="capitalize">{d}</span>
            </Chip>
          ))}
        </Row>
      )}
      {showCategories && facets.categories.length > 1 && (
        <Row label="Category">
          {facets.categories.map((c) => (
            <Chip key={c.slug} href={hrefWith(base, params, { category: params.category === c.slug ? undefined : c.slug })} active={params.category === c.slug}>
              {CATEGORY_LABELS[c.slug]} <span className="text-stone">{c.count}</span>
            </Chip>
          ))}
        </Row>
      )}
      {facets.colours.length > 1 && (
        <Row label="Colour">
          {facets.colours.slice(0, 14).map((c) => (
            <Chip key={c.name} href={hrefWith(base, params, { colour: params.colour?.toLowerCase() === c.name.toLowerCase() ? undefined : c.name })} active={params.colour?.toLowerCase() === c.name.toLowerCase()} swatch={c.hex}>
              {c.name}
            </Chip>
          ))}
        </Row>
      )}
      {facets.sizes.length > 1 && (
        <Row label="Size">
          {facets.sizes.map((s) => (
            <Chip key={s} href={hrefWith(base, params, { size: params.size === s ? undefined : s })} active={params.size === s}>
              {s}
            </Chip>
          ))}
        </Row>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow mr-2 w-16 shrink-0">{label}</span>
      {children}
    </div>
  );
}
