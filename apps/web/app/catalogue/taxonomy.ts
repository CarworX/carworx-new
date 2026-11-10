/**
 * The public category tree (D-083). The design's front door has five fixed
 * service keys (app/ui/services.ts); four are bookable catalogue categories
 * and Fines is its own guidance area (P2-6). Repairs & Maintenance groups
 * four subcategories. Slugs match supabase/seed.sql; an integration test
 * checks every live category is covered here.
 */
import type { Service } from "../ui/services";

export interface DesignCategory {
  key: Exclude<Service["key"], "fines">;
  slug: string;
  label: string;
  children: readonly { slug: string; label: string }[];
}

export const CATEGORIES: readonly DesignCategory[] = [
  {
    key: "wash",
    slug: "wash-and-detailing",
    label: "Wash & Detailing",
    children: [],
  },
  {
    key: "repairs",
    slug: "repairs-and-maintenance",
    label: "Repairs & Maintenance",
    children: [
      { slug: "mechanical-service", label: "Mechanical service" },
      { slug: "panel-and-paint", label: "Panel and paint" },
      { slug: "auto-electrical", label: "Auto electrical" },
      { slug: "mobile-mechanic", label: "Mobile mechanic" },
    ],
  },
  {
    key: "glass",
    slug: "glass-repair-and-replacement",
    label: "Glass Repair & Replacement",
    children: [],
  },
  {
    key: "tyres",
    slug: "tyres-and-wheel-alignment",
    label: "Tyres & Wheel Alignment",
    children: [],
  },
];

export function findCategory(slug: string): DesignCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** The top-level design category a (sub)category slug belongs to. */
export function topCategoryOf(slug: string): DesignCategory | undefined {
  return CATEGORIES.find(
    (c) => c.slug === slug || c.children.some((k) => k.slug === slug),
  );
}

/** All catalogue category slugs a design category covers. */
export function slugsFor(category: DesignCategory): string[] {
  return [category.slug, ...category.children.map((c) => c.slug)];
}

/** Front-door links for app/ui/ServiceKeys, in the fixed design order. */
export const SERVICE_HREFS: Record<Service["key"], string> = {
  wash: "/c/wash-and-detailing",
  repairs: "/c/repairs-and-maintenance",
  glass: "/c/glass-repair-and-replacement",
  tyres: "/c/tyres-and-wheel-alignment",
  fines: "/fines",
};
