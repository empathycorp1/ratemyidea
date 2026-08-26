/**
 * The canonical category list — must stay in sync with the category
 * list in scoring-prompt.ts's "## Category" section, since that's what
 * the model is instructed to choose from and lib/score-idea.ts enforces
 * server-side.
 *
 * homepage-prototype.html's own CATS array doesn't match this: it has
 * "Food" (never a real category — the scorer never assigns it) and is
 * missing "developer-tools", "social", and "productivity" (real
 * categories the scorer does assign). Tabs built from the prototype's
 * literal list would have permanently-empty pills and no way to filter
 * to real categories that exist in the data, so this list is built
 * from what the scorer actually assigns instead, with display labels
 * chosen to match the prototype's casing style (e.g. "Saas", not
 * "SaaS").
 */
export const CATEGORY_VALUES = [
  "ai",
  "developer-tools",
  "consumer-app",
  "marketplace",
  "saas",
  "fintech",
  "health",
  "education",
  "ecommerce",
  "social",
  "hardware",
  "gaming",
  "media",
  "productivity",
  "sustainability",
  "other",
] as const;

export type CategoryValue = (typeof CATEGORY_VALUES)[number];

export const CATEGORY_LABELS: Record<CategoryValue, string> = {
  ai: "AI",
  "developer-tools": "Developer tools",
  "consumer-app": "Consumer app",
  marketplace: "Marketplace",
  saas: "Saas",
  fintech: "Fintech",
  health: "Health",
  education: "Education",
  ecommerce: "Ecommerce",
  social: "Social",
  hardware: "Hardware",
  gaming: "Gaming",
  media: "Media",
  productivity: "Productivity",
  sustainability: "Sustainability",
  other: "Other",
};

/** Ordered roughly by expected frequency, so the most useful tabs are
 *  the ones visible before "More" (see VISIBLE in the board component). */
export const CATEGORY_TAB_ORDER: CategoryValue[] = [
  "saas",
  "fintech",
  "marketplace",
  "ai",
  "consumer-app",
  "hardware",
  "health",
  "ecommerce",
  "developer-tools",
  "education",
  "social",
  "gaming",
  "media",
  "productivity",
  "sustainability",
  "other",
];

export const ALLOWED_CATEGORIES: ReadonlySet<string> = new Set(
  CATEGORY_VALUES
);
