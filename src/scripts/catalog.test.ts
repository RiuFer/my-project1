import { describe, expect, test } from "bun:test";
import catalog from "../data/catalog.json";
import type { Catalog } from "../data/types";
import { addrOneLine, channels, handleOf, kind, socialParts, streetLine, telHref } from "./channels";
import { readFilters, writeFilters } from "./columns";
import { NAMES } from "./constants";
import { emptyFilters, evaluate, searchHits, searchHitsYield, termHit, toggleCity } from "./filter";
import { buildModel } from "./model";
import { readQueryText, writeQueryText } from "./search";
import { fold, norm, sortKey, termsFrom } from "./text";

const data = catalog as unknown as Catalog;
const model = buildModel(data);

describe("catalog", () => {
  test("tuple shape", () => {
    expect(data.locs.length).toBeGreaterThan(1000);
    expect(data.games.length).toBeGreaterThan(0);
    expect(typeof data.updated).toBe("string");
    expect(typeof data.groups).toBe("object");
    expect(typeof data.placeAliases).toBe("object");
    expect(typeof data.retired).toBe("string");
    expect(typeof data.redirects).toBe("object");
    for (const loc of data.locs) {
      expect(loc.a).toHaveLength(7);
      expect(loc.f.every((fact) => fact.length === 8)).toBe(true);
      expect(Array.isArray(loc.p) && Array.isArray(loc.e) && Array.isArray(loc.w) && Array.isArray(loc.o) && Array.isArray(loc.k)).toBe(true);
    }
  });

  test("accent folding", () => {
    expect(fold("Montréal")).toBe("montreal");
    expect(norm("Trois-Rivières")).toBe(" trois rivieres ");
    expect(norm("St. John's")).toBe(" st johns ");
    const accented = searchHits(model, termsFrom("Montréal"), emptyFilters());
    expect(accented.some((hit) => hit.m.some((loc) => loc.id === "1000000-comix-montreal"))).toBe(true);
    const river = searchHits(model, termsFrom("trois rivieres"), emptyFilters());
    expect(river.some((hit) => hit.m.some((loc) => loc.community === "Trois-Rivières"))).toBe(true);
  });

  test("short alias", () => {
    expect(termHit(" news ", "ws", { ws: 1 })).toBe(false);
    expect(termHit(" ws ", "ws", { ws: 1 })).toBe(true);
    const weiss = searchHits(model, termsFrom("ws"), emptyFilters());
    expect(weiss.length).toBeGreaterThan(0);
    expect(weiss.every((hit) => hit.m.some((loc) => loc.games.weiss))).toBe(true);
    const archive = searchHits(model, termsFrom("ga"), emptyFilters());
    expect(archive.some((hit) => hit.m.some((loc) => loc.games.grandarchive))).toBe(true);
    expect(archive.every((hit) => hit.m.some((loc) => loc.games.grandarchive))).toBe(true);
  });

  test("province filter and chain row", () => {
    const quebec = emptyFilters();
    quebec.city["p:QC"] = true;
    const hits = searchHits(model, [], quebec);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.m.every((loc) => loc.prov === "QC"))).toBe(true);

    const chain = model.entries.find((entry) => entry.name === "The Comic Hunter");
    expect(chain?.locs).toHaveLength(3);
    expect(model.entries.filter((entry) => entry.name === "The Comic Hunter")).toHaveLength(1);
    expect(sortKey("The Comic Hunter")).toBe("comic hunter");
    expect(sortKey("L'Entre-Jeux")).toBe("entre-jeux");

    const island = emptyFilters();
    island.city["p:PE"] = true;
    const narrowed = chain ? evaluate(chain, [], island, model) : null;
    expect(narrowed?.m.map((loc) => loc.prov)).toEqual(["PE"]);

    const city: Record<string, true> = { "m:QC|Montréal": true };
    toggleCity(city, "p:QC");
    expect(city).toEqual({ "p:QC": true });
    toggleCity(city, "m:QC|Québec");
    expect(city["p:QC"]).toBeUndefined();
    expect(city["m:QC|Québec"]).toBe(true);
  });

  test("short queries match a whole token", () => {
    expect(termHit(" toronto ", "on", {})).toBe(false);
    expect(termHit(" on ", "on", {})).toBe(true);
    expect(termHit(" street ", "st", {})).toBe(false);
    expect(termHit(" st johns ", "st", {})).toBe(true);
    expect(termHit(" mtg ", "mt", {})).toBe(false);
    expect(termHit(" news ", "a", {})).toBe(true);

    const tokenShops = (token: string) => model.entries.filter((entry) => entry.locs.some((loc) => loc.hay.includes(` ${token} `))).length;
    const insideShops = (token: string) => model.entries.filter((entry) => entry.locs.some((loc) => loc.hay.includes(token))).length;

    const on = searchHits(model, termsFrom("on"), emptyFilters());
    expect(on.length).toBe(tokenShops("on"));
    expect(on.length).toBeLessThan(insideShops("on"));
    expect(on.every((hit) => hit.m.some((loc) => loc.hay.includes(" on ")))).toBe(true);

    const street = searchHits(model, termsFrom("st"), emptyFilters());
    expect(street.length).toBe(tokenShops("st"));
    expect(street.length).toBeLessThan(insideShops("st"));
    expect(street.every((hit) => hit.m.some((loc) => loc.hay.includes(" st ")))).toBe(true);

    const mt = searchHits(model, termsFrom("mt"), emptyFilters());
    expect(mt.length).toBe(tokenShops("mt"));
    expect(mt.length).toBeLessThan(insideShops("mt"));
    const magic = searchHits(model, termsFrom("mtg"), emptyFilters());
    expect(magic.length).toBeGreaterThan(0);
    expect(magic.every((hit) => hit.m.some((loc) => loc.games.mtg))).toBe(true);
    expect(mt.length).toBeLessThan(magic.length);

    expect(searchHits(model, termsFrom("a"), emptyFilters())).toHaveLength(model.entries.length);
    const letter = searchHits(model, termsFrom("a montreal"), emptyFilters()).map((hit) => hit.e.name);
    const word = searchHits(model, termsFrom("montreal"), emptyFilters()).map((hit) => hit.e.name);
    expect(letter).toEqual(word);

    for (const code of ["ab", "mb", "bc", "pe", "ns", "nb", "qc"]) {
      const hits = searchHits(model, termsFrom(code), emptyFilters());
      expect(hits.length).toBe(tokenShops(code));
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((hit) => hit.m.some((loc) => loc.hay.includes(` ${code} `)))).toBe(true);
    }
    expect(searchHits(model, termsFrom("qc"), emptyFilters())).toHaveLength(insideShops("qc"));
  });

  test("cards known hides shops with no games", () => {
    const filters = emptyFilters();
    filters.known = true;
    const hits = searchHits(model, [], filters);
    const withCards = model.entries.filter((entry) => entry.locs.some((loc) => loc.gameList.length));
    expect(withCards.length).toBeLessThan(model.entries.length);
    expect(hits).toHaveLength(withCards.length);
    expect(hits.every((hit) => hit.m.every((loc) => loc.gameList.length > 0))).toBe(true);
  });

  test("link filters keep a shop only when it has every pick", () => {
    const filters = emptyFilters();
    filters.active.phone = true;
    filters.active.email = true;
    const phoneOnly = model.entries.find(
      (entry) => entry.locs.some((loc) => loc.ch.phone.length > 0) && entry.locs.every((loc) => loc.ch.email.length === 0),
    );
    const both = model.entries.find((entry) => entry.locs.some((loc) => loc.ch.phone.length > 0 && loc.ch.email.length > 0));
    expect(phoneOnly).toBeTruthy();
    expect(both).toBeTruthy();
    expect(phoneOnly && evaluate(phoneOnly, [], filters, model)).toBeNull();
    expect(both && evaluate(both, [], filters, model)).not.toBeNull();
  });

  test("search and filters round-trip through the query string", () => {
    const filters = emptyFilters();
    filters.games.pokemon = true;
    filters.games.mtg = true;
    filters.city["p:QC"] = true;
    filters.city["m:ON|Toronto"] = true;
    filters.active.phone = true;
    filters.active.email = true;
    filters.known = true;
    const params = new URLSearchParams();
    writeQueryText(params, "  on toronto  ");
    writeFilters(params, filters);
    const search = params.toString();
    expect(readQueryText(search)).toBe("on toronto");
    expect(readFilters(search, model)).toEqual(filters);

    const junk = readFilters("?g=not-a-game&in=p:ZZ&in=m:ON|Nowhere&link=fax&known=yes", model);
    expect(junk).toEqual(emptyFilters());
  });

  test("references", () => {
    const ids = data.locs.map((loc) => loc.id);
    expect(new Set(ids).size).toBe(ids.length);

    const gameIds = new Set(data.games.map((game) => game.id));
    const badPhones: string[] = [];
    const badProvinces: string[] = [];
    let facts = 0;
    let unknown = 0;
    for (const loc of data.locs) {
      if (!NAMES[loc.a[4]]) badProvinces.push(`${loc.id} ${loc.a[4]}`);
      for (const fact of loc.f) {
        facts++;
        if (!gameIds.has(fact[0])) unknown++;
      }
      for (const phone of loc.p) {
        const digits = phone.replace(/ext\..*$/i, "").replace(/\D/g, "");
        if (digits.length !== 10 && digits.length !== 11) badPhones.push(`${loc.id} ${phone}`);
      }
    }
    expect(badProvinces).toEqual([]);
    expect(badPhones).toEqual([]);
    expect(unknown).toBe(0);
    expect(facts).toBeGreaterThan(0);

    const retired = new Set((data.retired || "").split(" ").filter(Boolean));
    expect(retired.size).toBeGreaterThan(0);
    expect(data.locs.filter((loc) => retired.has(loc.id))).toEqual([]);

    const badRedirects: string[] = [];
    for (const [from, target] of Object.entries(data.redirects)) {
      let id = target;
      const seen = new Set<string>([from]);
      let hops = 0;
      let loop = false;
      while (data.redirects[id] && hops++ < 10) {
        if (seen.has(id)) {
          loop = true;
          break;
        }
        seen.add(id);
        id = data.redirects[id] ?? id;
      }
      if (loop || (!ids.includes(id) && !retired.has(id))) badRedirects.push(from);
    }
    expect(badRedirects).toEqual([]);

    const names = Object.values(data.groups);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !name.trim())).toEqual([]);
    for (const loc of data.locs) if (loc.g) expect(data.groups[loc.g]).toBeTruthy();
  });
});

describe("channels", () => {
  test("social link parsing", () => {
    expect(kind("https://www.facebook.com/foo")).toBe("Facebook");
    expect(kind("https://x.com/shop")).toBe("X");
    expect(kind("https://linktr.ee/shop")).toBe("Links");
    expect(kind("https://facetofacegames.com")).toBeNull();

    expect(handleOf("https://www.facebook.com/people/Bunker-Collectibles/61592331273797", "Facebook")).toBe("Bunker-Collectibles");
    expect(handleOf("https://www.facebook.com/p/Carl-G-Wargaming-100057537665485", "Facebook")).toBe("Carl-G-Wargaming");
    expect(handleOf("https://www.facebook.com/pages/games-people-play/234963396531095", "Facebook")).toBe("games-people-play");
    expect(handleOf("https://www.facebook.com/sharer/sharer.php", "Facebook")).toBe("");
    expect(handleOf("https://www.reddit.com/r/magicTCG", "Reddit")).toBe("r/magicTCG");
    expect(handleOf("https://www.reddit.com/user/someone", "Reddit")).toBe("u/someone");
    expect(handleOf("https://discord.gg/abc", "Discord")).toBe("");
    expect(handleOf("https://www.youtube.com/c/ChannelName", "YouTube")).toBe("ChannelName");
    expect(handleOf("https://www.youtube.com/@Handle", "YouTube")).toBe("Handle");
    expect(handleOf("https://www.youtube.com/watch?v=abc", "YouTube")).toBe("");
    expect(handleOf("https://bsky.app/profile/name.bsky.social", "Bluesky")).toBe("name.bsky.social");
    expect(handleOf("https://www.etsy.com/shop/ShopName", "Etsy")).toBe("ShopName");
    expect(handleOf("https://shopname.etsy.com", "Etsy")).toBe("shopname");
    expect(handleOf("https://www.linkedin.com/company/acme", "LinkedIn")).toBe("acme");
    expect(handleOf("https://name.tumblr.com/post/1", "Tumblr")).toBe("name");
    expect(handleOf("https://www.tumblr.com/blog/view/name", "Tumblr")).toBe("name");
    expect(handleOf("https://www.snapchat.com/add/name", "Snapchat")).toBe("name");
    expect(handleOf("https://www.amazon.ca/shops/ShopName", "Amazon")).toBe("ShopName");
    expect(handleOf("https://www.ebay.ca/str/chamaxenterprises", "eBay")).toBe("chamaxenterprises");
    expect(handleOf("https://www.whatnot.com/user/shop", "Whatnot")).toBe("shop");
    expect(handleOf("https://www.cardtrader.com/users/shop", "CardTrader")).toBe("shop");
    expect(handleOf("https://www.kijiji.ca/v-view/abc", "Kijiji")).toBe("");
    expect(socialParts("https://linktr.ee/shop")).toEqual(["Linktree", "shop"]);
    expect(socialParts("https://facetofacegames.com/en")).toEqual(["", "facetofacegames.com"]);

    const set = channels({
      street: "1 Main St",
      phones: ["(514) 725-1355"],
      emails: [],
      webs: ["https://www.facebook.com/foo", "https://example.com/"],
      socials: ["https://facebook.com/foo/"],
    });
    expect(set.maps).toBe(true);
    expect(set.web).toEqual(["https://example.com/"]);
    expect(set.social).toEqual(["https://www.facebook.com/foo"]);
    expect(channels({ street: "", phones: [], emails: [], webs: [], socials: [] }).maps).toBe(false);

    expect(telHref("(514) 725-1355")).toBe("tel:+15147251355");
    expect(telHref("1-866-235-7002 ext. 4")).toBe("tel:+18662357002;ext=4");
    expect(streetLine({ street: "90 Russett Ave", unit: "5" })).toBe("5-90 Russett Ave");
    expect(streetLine({ street: "", unit: "5" })).toBe("");
    expect(
      addrOneLine({ unit: "", street: "3868 Rue Jean-Talon E", community: "Montréal", prov: "QC", postal: "H2A 1Y7" }),
    ).toBe("3868 Rue Jean-Talon E, Montréal QC H2A 1Y7");

    for (const loc of data.locs) {
      for (const url of loc.w.concat(loc.o)) {
        const parts = socialParts(url);
        expect(parts).toHaveLength(2);
      }
      expect(channels({ street: loc.a[1], phones: loc.p, emails: loc.e, webs: loc.w, socials: loc.o }).maps).toBe(!!loc.a[1]);
    }
  });

  test("yielded search matches the sync scan", async () => {
    const filters = emptyFilters();
    const terms = termsFrom("montreal");
    expect(await searchHitsYield(model, terms, filters)).toEqual(searchHits(model, terms, filters));
    expect(await searchHitsYield(model, [], filters)).toEqual(searchHits(model, [], filters));
    let stale = false;
    const pending = searchHitsYield(model, [], filters, () => stale);
    stale = true;
    expect(await pending).toBeNull();
  });
});
