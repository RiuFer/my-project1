import type { Location } from "./model";

export function whereText(locations: Location[]): string {
  const seen: Record<string, 1> = {};
  const unique = locations.filter((location) => {
    const key = `${location.prov}|${location.community}`;
    if (seen[key]) return false;
    seen[key] = 1;
    return true;
  });
  const one = (location: Location) => [location.community, location.prov].filter(Boolean).join(", ");
  const first = unique[0];
  if (!first) return "—";
  if (unique.length === 1) return one(first);
  const second = unique[1];
  if (unique.length === 2 && second && first.prov === second.prov)
    return `${first.community} & ${second.community}, ${first.prov}`;
  return `${one(first)} +${unique.length - 1}`;
}
