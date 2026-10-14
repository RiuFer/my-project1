import type { ChannelKey } from "./constants";
import { host } from "./text";

export interface ChannelSource {
  street: string;
  phones: string[];
  emails: string[];
  webs: string[];
  socials: string[];
}

export interface Channels {
  maps: boolean;
  phone: string[];
  email: string[];
  web: string[];
  social: string[];
}

// Social networks, link pages and marketplace store pages. None of these is a shop's own website,
// so a link on one of them always goes under Social, even when the data lists it as the website.
const SOCIAL: readonly (readonly [string, RegExp])[] = [
  ["Facebook", /(^|\.)(facebook\.com|fb\.com|fb\.me|fb\.watch)$/],
  ["Messenger", /(^|\.)(m\.me|messenger\.com)$/],
  ["Instagram", /(^|\.)(instagram\.com|instagr\.am)$/],
  ["Threads", /(^|\.)threads\.(net|com)$/],
  ["TikTok", /(^|\.)tiktok\.com$/],
  ["X", /(^|\.)(twitter\.com|x\.com)$/],
  ["Bluesky", /(^|\.)bsky\.app$/],
  ["YouTube", /(^|\.)(youtube\.com|youtu\.be)$/],
  ["Twitch", /(^|\.)twitch\.tv$/],
  ["Discord", /(^|\.)(discord\.gg|discord\.com)$/],
  ["Reddit", /(^|\.)reddit\.com$/],
  ["Pinterest", /(^|\.)pinterest\.(com|ca)$/],
  ["LinkedIn", /(^|\.)linkedin\.com$/],
  ["Tumblr", /(^|\.)tumblr\.com$/],
  ["Snapchat", /(^|\.)snapchat\.com$/],
  ["Links", /(^|\.)(linktr\.ee|beacons\.ai|linkin\.bio|linkpop\.com|paa\.ge)$/],
  ["eBay", /(^|\.)ebay\.[a-z.]+$/],
  ["Etsy", /(^|\.)etsy\.com$/],
  ["Amazon", /(^|\.)amazon\.(ca|com)$/],
  ["Kijiji", /(^|\.)kijiji\.ca$/],
  ["Whatnot", /(^|\.)whatnot\.com$/],
  ["CardTrader", /(^|\.)cardtrader\.com$/],
  ["TCGplayer", /(^|\.)tcgplayer\.com$/],
  ["Cardmarket", /(^|\.)cardmarket\.com$/],
];

const NOT_A_NAME =
  /^(\d+|profile\.php|pages|people|groups|events|share|sharer(\.php)?|watch|marketplace|p|reels?|stories|explore|story\.php|permalink\.php|photo\.php|home(\.php)?|intent|i|search|hashtag|channel|shorts|playlist|results|t|m|s)$/i;

export const LINK_PAGES: Record<string, string> = {
  "linktr.ee": "Linktree",
  "beacons.ai": "Beacons",
  "linkin.bio": "Linkin.bio",
  "linkpop.com": "Linkpop",
  "paa.ge": "Paa.ge",
};

/** The platform's name when the link is on a social or marketplace site, otherwise null. */
export function kind(url: string): string | null {
  const hostname = host(url);
  for (const [name, pattern] of SOCIAL) if (pattern.test(hostname)) return name;
  return null;
}

function segmentAt(segments: string[], pattern: RegExp): string {
  for (let i = 0; i < segments.length - 1; i++) if (pattern.test(segments[i] ?? "")) return segments[i + 1] ?? "";
  return "";
}

/** The account name in a social link, or "" when the link has none. */
export function handleOf(url: string, platform: string): string {
  let parsed: URL;
  try {
    parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`);
  } catch {
    return "";
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const segments = parsed.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  let name = segments[0] || "";
  if (platform === "Bluesky") name = segmentAt(segments, /^profile$/i);
  else if (platform === "Whatnot") name = segmentAt(segments, /^(user|invite)$/i);
  else if (platform === "Amazon") name = segmentAt(segments, /^shops$/i);
  else if (platform === "CardTrader" || platform === "TCGplayer" || platform === "Cardmarket")
    name = segmentAt(segments, /^(users?|sellers?|shops?)$/i);
  else if (platform === "Kijiji" || platform === "Discord") name = "";
  else if (platform === "Reddit")
    name = /^(r|u|user)$/i.test(name) && segments[1] ? (/^r$/i.test(name) ? "r/" : "u/") + segments[1] : "";
  else if (platform === "Snapchat") name = /^add$/i.test(name) ? segments[1] || "" : name;
  else if (platform === "LinkedIn") name = segmentAt(segments, /^(company|in|school)$/i);
  else if (platform === "Tumblr")
    name =
      hostname.split(".").length > 2 && hostname !== "tumblr.com"
        ? (hostname.split(".")[0] ?? "")
        : /^blog$/i.test(name)
          ? (segments[1] === "view" ? segments[2] : segments[1]) || ""
          : name;
  else if (platform === "YouTube" && /^(c|user)$/i.test(name)) name = segments[1] || "";
  else if (platform === "Etsy")
    name = /^shop$/i.test(name) ? segments[1] || "" : hostname.split(".").length > 2 ? (hostname.split(".")[0] ?? "") : "";
  else if (platform === "eBay") name = /^(stores|shop)\./.test(hostname) ? name : segmentAt(segments, /^(usr|str|sch)$/i);
  else if (platform === "Facebook" && /^p$/i.test(name)) name = (segments[1] || "").replace(/-\d{6,}$/, "");
  else if (platform === "Facebook" && /^(people|pages)$/i.test(name)) name = segments[1] || "";
  name = name.replace(/^@/, "");
  return !name || NOT_A_NAME.test(name) ? "" : name;
}

/** [platform, username]. A link that isn't on a social site gives ["", its site]. */
export function socialParts(url: string): [string, string] {
  const platform = kind(url);
  if (!platform) return ["", host(url)];
  const named = platform === "Links" ? LINK_PAGES[host(url)] || "Link page" : platform;
  return [named, handleOf(url, platform)];
}

export function socialLabel(url: string): string {
  return socialParts(url).filter(Boolean).join(" ");
}

export function platformOf(url: string): string {
  return kind(url) || host(url);
}

export function channels(source: ChannelSource): Channels {
  const result: Channels = {
    maps: !!source.street,
    phone: source.phones,
    email: source.emails,
    web: [],
    social: [],
  };
  const seen: Record<string, 1> = {};
  const urls = source.webs.concat(source.socials);
  urls.forEach((url, index) => {
    const key = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
    if (seen[key]) return;
    seen[key] = 1;
    // a social or marketplace page listed as the website still goes under Social
    const bucket = kind(url) ? "social" : index < source.webs.length ? "web" : "social";
    result[bucket].push(url);
  });
  return result;
}

export function hasChannel(set: Channels, key: ChannelKey): boolean {
  const value = set[key];
  return key === "maps" ? !!value : (value as string[]).length > 0;
}

export function telHref(phone: string): string {
  const extension = phone.match(/ext\.\s*(\d+)/);
  const digits = phone.replace(/ext\..*$/, "").replace(/\D/g, "");
  return `tel:+${digits.length === 10 ? `1${digits}` : digits}${extension ? `;ext=${extension[1]}` : ""}`;
}

export function streetLine(location: { street: string; unit: string }): string {
  return location.street ? (location.unit ? `${location.unit}-${location.street}` : location.street) : "";
}

export function mapsHref(location: {
  name: string;
  unit: string;
  street: string;
  community: string;
  prov: string;
  postal: string;
}): string {
  const query = [location.name, streetLine(location), location.community, location.prov, location.postal]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** The address on one line: "3868 Rue Jean-Talon E, Montréal QC H2A 1Y7". */
export function addrOneLine(location: {
  unit: string;
  street: string;
  community: string;
  prov: string;
  postal: string;
}): string {
  const cityProv = [location.community, location.prov].filter(Boolean).join(" ");
  return [streetLine(location), [cityProv, location.postal].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}
