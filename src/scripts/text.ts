import { MONTHS, ORDER } from "./constants";

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Accents folded, then lowercased. œ and æ do not decompose in NFD. */
export function fold(value: string): string {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");
}

/** Search form: accents, case and punctuation ignored ("St. John's" = "st johns"). */
export function norm(value: string): string {
  return ` ${fold(value)
    .replace(/['’.]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
}

export function esc(value: string): string {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPE[char] ?? char);
}

export function host(url: string): string {
  try {
    const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(absolute).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return String(url).toLowerCase();
  }
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-CA");
}

export function toHttps(url: string): string {
  return String(url).replace(/^http:\/\//i, "https://");
}

export function day(iso: string): string {
  const parts = iso.split("-");
  const month = MONTHS[Number(parts[1]) - 1] ?? "";
  return `${Number(parts[2])} ${month.slice(0, 3)} ${parts[0]}`;
}

export function month(iso: string): string {
  const parts = iso.split("-");
  const name = MONTHS[Number(parts[1]) - 1] ?? "";
  return `${name} ${parts[0]}`;
}

/** Names sort without a leading article: "The Comic Hunter" under C, "L'Entre-Jeux" under E. */
export function sortKey(name: string): string {
  return fold(name)
    .replace(/^(the|le|la|les)\s+/, "")
    .replace(/^l['’]\s*/, "");
}

export function cmpFr(a: string, b: string): number {
  return a.localeCompare(b, "fr-CA", { sensitivity: "base" });
}

export function provinceRank(province: string): number {
  const index = ORDER.indexOf(province);
  return index < 0 ? 99 : index;
}

export function termsFrom(query: string): string[] {
  return norm(query).trim().split(" ").filter(Boolean);
}
