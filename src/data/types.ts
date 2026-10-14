/** Address fields, in order: unit, street, community, municipality, province, postal code, note. */
export type AddressTuple = [string, string, string, string, string, string, string];

/** Fact fields, in order: game, kind, source, url, date, seen, scope, note. */
export type FactTuple = [string, string, string, string, string, string, string, string];

export interface GameRecord {
  id: string;
  name: string;
  short: string;
  aliases: string[];
}

export interface LocRecord {
  id: string;
  g: string | null;
  n: string;
  b: string;
  k: string[];
  s: string;
  a: AddressTuple;
  p: string[];
  e: string[];
  w: string[];
  o: string[];
  c: string;
  f: FactTuple[];
}

export interface Catalog {
  updated: string;
  games: GameRecord[];
  groups: Record<string, string>;
  placeAliases: Record<string, string[]>;
  locs: LocRecord[];
  retired: string;
  redirects: Record<string, string>;
}
