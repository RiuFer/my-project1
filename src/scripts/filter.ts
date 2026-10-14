import { hasChannel } from "./channels";
import { CH, type ChannelKey } from "./constants";
import type { Entry, Location, Model } from "./model";

export interface Filters {
  games: Record<string, true>;
  city: Record<string, true>;
  active: Record<string, boolean>;
  known: boolean;
}

export interface Hit {
  e: Entry;
  m: Location[];
  main: Location;
  games: string[];
  score: number;
}

export function emptyFilters(): Filters {
  return { games: {}, city: {}, active: {}, known: false };
}

export function picked(map: Record<string, boolean | undefined>): string[] {
  return Object.keys(map).filter((key) => map[key]);
}

export function linksActive(active: Record<string, boolean | undefined>): boolean {
  return CH.some((channel) => active[channel.k]);
}

/**
 * A one-letter query is ignored. Two letters, and a game alias of three or fewer,
 * match only as their own token, so "on" doesn't match Toronto and "ws" doesn't match "news".
 */
export function termHit(hay: string, term: string, shortAlias: Record<string, 1 | undefined>): boolean {
  if (term.length < 2) return true;
  return term.length === 2 || shortAlias[term] ? hay.includes(` ${term} `) : hay.includes(term);
}

export function locationInCity(location: Location, city: Record<string, true | undefined>): boolean {
  return !!(city[`p:${location.prov}`] || city[`m:${location.prov}|${location.muni}`]);
}

/**
 * Picking a province replaces municipalities chosen one by one.
 * Picking a municipality inside a picked province narrows that province to the municipality.
 */
export function toggleCity(city: Record<string, true>, value: string): void {
  if (value.startsWith("p:")) {
    const province = value.slice(2);
    const on = !city[value];
    for (const key of Object.keys(city)) if (key.startsWith(`m:${province}|`)) delete city[key];
    if (on) city[value] = true;
    else delete city[value];
    return;
  }
  const province = `p:${value.slice(2).split("|")[0] ?? ""}`;
  if (city[province]) {
    delete city[province];
    city[value] = true;
  } else if (city[value]) delete city[value];
  else city[value] = true;
}

export function toggleGame(games: Record<string, true>, id: string): void {
  if (games[id]) delete games[id];
  else games[id] = true;
}

export function toggleLink(active: Record<string, boolean>, key: string): void {
  active[key] = !active[key];
}

/** An entry stays when one of its locations passes every filter. The row stands for the first such location. */
export function evaluate(entry: Entry, terms: string[], filters: Filters, model: Model): Hit | null {
  let matched = entry.locs;
  const games = picked(filters.games);
  if (filters.known) matched = matched.filter((location) => location.gameList.length > 0);
  if (picked(filters.city).length) matched = matched.filter((location) => locationInCity(location, filters.city));
  if (games.length) matched = matched.filter((location) => games.some((id) => location.games[id]));
  if (terms.length) matched = matched.filter((location) => terms.every((term) => termHit(location.hay, term, model.shortAlias)));
  // Cards and cities keep a shop when any pick hits. Every link pick has to be present.
  if (linksActive(filters.active)) {
    matched = matched.filter((location) =>
      CH.every((channel) => !filters.active[channel.k] || hasChannel(location.ch, channel.k as ChannelKey)),
    );
  }
  const first = matched[0];
  if (!first) return null;
  const present: Record<string, 1> = {};
  for (const location of matched) for (const id of location.gameList) present[id] = 1;
  const ids = Object.keys(present).sort((a, b) => (model.gamesById[a]?.rank ?? 0) - (model.gamesById[b]?.rank ?? 0));
  return {
    e: entry,
    m: matched,
    main: first,
    games: ids,
    score: games.filter((id) => present[id]).length,
  };
}

function rankHits(hits: Hit[], filters: Filters): Hit[] {
  if (picked(filters.games).length > 1) hits.sort((a, b) => b.score - a.score || a.e.i - b.e.i);
  return hits;
}

function yieldThread(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Several picked games: shops carrying more of them come first, then the article-stripped directory order. */
export function searchHits(model: Model, terms: string[], filters: Filters): Hit[] {
  const hits: Hit[] = [];
  for (const entry of model.entries) {
    const hit = evaluate(entry, terms, filters, model);
    if (hit) hits.push(hit);
  }
  return rankHits(hits, filters);
}

/** Same rows as searchHits. The scan yields so the first paint is not one long task. */
export async function searchHitsYield(
  model: Model,
  terms: string[],
  filters: Filters,
  stale: () => boolean = () => false,
): Promise<Hit[] | null> {
  await yieldThread();
  if (stale()) return null;
  const hits: Hit[] = [];
  const entries = model.entries;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry) continue;
    const hit = evaluate(entry, terms, filters, model);
    if (hit) hits.push(hit);
    if ((index + 1) % 300 === 0) {
      await yieldThread();
      if (stale()) return null;
    }
  }
  return rankHits(hits, filters);
}
