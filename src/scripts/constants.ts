export const NAMES: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

/** Provinces by population, largest first (Statistics Canada estimates, Oct 1 2025). */
export const ORDER = ["ON", "QC", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE", "YT", "NT", "NU"];

export const STATUS: Record<string, string> = {
  "online-only": "Online only",
  mobile: "By appointment / mobile",
};

export const SOURCE: Record<string, string> = {
  "official-locator": "Official store list",
  "shop-website": "Shop's website",
  "shop-social": "Shop's social post",
  "chain-website": "Business's website",
  "event-platform": "Event listing",
  "shop-name": "Shop's name",
  manual: "Manual update",
};

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Each main game gets its own chip; every other game is counted in one "+N" chip. */
export const MAIN = ["pokemon", "mtg", "yugioh", "onepiece", "lorcana", "riftbound", "sports"];

export const CH = [
  { k: "maps", label: "Maps", c: "--c-maps", i: "pin" },
  { k: "phone", label: "Phone", c: "--c-phone", i: "phone" },
  { k: "email", label: "Email", c: "--c-email", i: "mail" },
  { k: "web", label: "Website", c: "--c-web", i: "globe" },
  { k: "social", label: "Social", c: "--c-social", i: "social" },
] as const;

export type ChannelKey = (typeof CH)[number]["k"];

export const DOWN =
  '<svg class="dn" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
