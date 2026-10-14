import type { Catalog } from "../data/types";
import { channels, type Channels } from "./channels";
import { NAMES } from "./constants";
import { cmpFr, host, norm, provinceRank, sortKey } from "./text";

export interface Fact {
  game: string;
  kind: string;
  source: string;
  url: string;
  date: string;
  seen: string;
  scope: string;
  note: string;
}

export interface Game {
  id: string;
  name: string;
  short: string;
  aliases: string[];
  rank: number;
}

export interface Entry {
  name: string;
  locs: Location[];
  key: string;
  i: number;
}

export interface Location {
  id: string;
  g: string | null;
  name: string;
  branch: string;
  aka: string[];
  status: string;
  unit: string;
  street: string;
  community: string;
  muni: string;
  prov: string;
  postal: string;
  note: string;
  phones: string[];
  emails: string[];
  webs: string[];
  socials: string[];
  checked: string;
  games: Record<string, 1>;
  sells: string[];
  hosts: string[];
  gameList: string[];
  facts: Fact[];
  ch: Channels;
  entry: Entry;
  hay: string;
}

export interface Model {
  updated: string;
  games: Game[];
  gamesById: Record<string, Game>;
  shortAlias: Record<string, 1>;
  entries: Entry[];
  locsById: Record<string, Location>;
  retired: Record<string, 1>;
  redirects: Record<string, string>;
  gcount: Record<string, number>;
  provs: string[];
  munisOf: Record<string, string[]>;
  mcount: Record<string, number>;
  commsOf: Record<string, Record<string, 1>>;
}

/** The worker sends the catalog in pieces so one message is not a long task. */
export type CatalogPart =
  | { kind: "meta"; model: Omit<Model, "entries" | "locsById"> }
  | { kind: "chunk"; entries: Entry[] }
  | { kind: "done" };

export function buildModel(catalog: Catalog): Model {
  const games: Game[] = (catalog.games ?? []).map((game, index) => ({ ...game, rank: index }));
  const gamesById: Record<string, Game> = {};
  const shortAlias: Record<string, 1> = {};
  for (const game of games) {
    gamesById[game.id] = game;
    // aliases of three letters or fewer ("ws", "ga", "mtg") only match a whole word
    for (const alias of [game.id, ...game.aliases]) {
      const token = norm(alias).trim();
      if (token && !token.includes(" ") && token.length <= 3) shortAlias[token] = 1;
    }
  }
  const byRank = (a: string, b: string) => (gamesById[a]?.rank ?? 0) - (gamesById[b]?.rank ?? 0);
  const placeAlias = catalog.placeAliases ?? {};

  const locations: Location[] = (catalog.locs ?? []).map((record) => {
    const location = {
      id: record.id,
      g: record.g,
      name: record.n,
      branch: record.b,
      aka: record.k,
      status: record.s,
      unit: record.a[0],
      street: record.a[1],
      community: record.a[2],
      muni: record.a[3],
      prov: record.a[4],
      postal: record.a[5],
      note: record.a[6],
      phones: record.p,
      emails: record.e,
      webs: record.w,
      socials: record.o,
      checked: record.c,
      games: {} as Record<string, 1>,
      sells: [] as string[],
      hosts: [] as string[],
      facts: record.f.map((fact) => ({
        game: fact[0],
        kind: fact[1],
        source: fact[2],
        url: fact[3],
        date: fact[4],
        seen: fact[5],
        scope: fact[6],
        note: fact[7],
      })),
    };
    for (const fact of location.facts) {
      location.games[fact.game] = 1;
      const bucket = fact.kind === "sells" ? location.sells : location.hosts;
      if (!bucket.includes(fact.game)) bucket.push(fact.game);
    }
    const gameList = Object.keys(location.games).sort(byRank);
    location.sells.sort(byRank);
    location.hosts.sort(byRank);
    const built = {
      ...location,
      gameList,
      ch: channels(location),
      entry: undefined as unknown as Entry,
      hay: "",
    };
    return built;
  });

  const locsById: Record<string, Location> = {};
  const entries: Entry[] = [];
  const byKey: Record<string, Entry> = {};
  for (const location of locations) {
    locsById[location.id] = location;
    const key = location.g ? `g:${location.g}` : `l:${location.id}`;
    let entry = byKey[key];
    if (!entry) {
      entry = { name: location.g ? (catalog.groups[location.g] ?? location.name) : location.name, locs: [], key: "", i: 0 };
      byKey[key] = entry;
      entries.push(entry);
    }
    entry.locs.push(location);
  }

  for (const entry of entries) {
    entry.locs.sort(
      (a, b) => provinceRank(a.prov) - provinceRank(b.prov) || cmpFr(a.community, b.community) || cmpFr(a.street, b.street),
    );
    entry.key = sortKey(entry.name);
    for (const location of entry.locs) {
      location.entry = entry;
      const parts = [
        location.name,
        entry.name,
        location.branch,
        location.aka.join(" "),
        location.unit,
        location.street,
        location.community,
        location.muni,
        location.prov,
        NAMES[location.prov] ?? "",
        location.postal,
        location.postal.replace(/\s/g, ""),
        location.phones.join(" "),
        location.phones.map((phone) => phone.replace(/\D/g, "")).join(" "),
        location.emails.join(" "),
        location.webs.map(host).join(" "),
        (placeAlias[location.community] ?? []).join(" "),
        (placeAlias[location.muni] ?? []).join(" "),
      ];
      for (const id of location.gameList) {
        const game = gamesById[id];
        if (game) parts.push(game.id, game.name, game.short, game.aliases.join(" "));
      }
      location.hay = norm(parts.join(" "));
    }
  }
  entries.sort((a, b) => cmpFr(a.key, b.key) || cmpFr(a.locs[0]?.community ?? "", b.locs[0]?.community ?? ""));
  entries.forEach((entry, index) => {
    entry.i = index;
  });

  const retired: Record<string, 1> = {};
  for (const id of (catalog.retired || "").split(" ")) if (id) retired[id] = 1;

  const gcount: Record<string, number> = {};
  const mcount: Record<string, number> = {};
  const munisOf: Record<string, Record<string, 1>> = {};
  const commsOf: Record<string, Record<string, 1>> = {};
  for (const entry of entries) {
    const seenGames: Record<string, 1> = {};
    const seenMunis: Record<string, 1> = {};
    for (const location of entry.locs) {
      for (const id of location.gameList) {
        if (!seenGames[id]) {
          seenGames[id] = 1;
          gcount[id] = (gcount[id] ?? 0) + 1;
        }
      }
      const muniKey = `${location.prov}|${location.muni}`;
      if (!seenMunis[muniKey]) {
        seenMunis[muniKey] = 1;
        mcount[muniKey] = (mcount[muniKey] ?? 0) + 1;
      }
      (munisOf[location.prov] ??= {})[location.muni] = 1;
      (commsOf[muniKey] ??= {})[location.community] = 1;
    }
  }
  const provs = Object.keys(munisOf).sort((a, b) => provinceRank(a) - provinceRank(b));
  const munisSorted: Record<string, string[]> = {};
  for (const province of Object.keys(munisOf)) {
    munisSorted[province] = Object.keys(munisOf[province] ?? {}).sort(
      (a, b) => (mcount[`${province}|${b}`] ?? 0) - (mcount[`${province}|${a}`] ?? 0) || cmpFr(a, b),
    );
  }

  return {
    updated: catalog.updated,
    games,
    gamesById,
    shortAlias,
    entries,
    locsById,
    retired,
    redirects: catalog.redirects ?? {},
    gcount,
    provs,
    munisOf: munisSorted,
    mcount,
    commsOf,
  };
}
