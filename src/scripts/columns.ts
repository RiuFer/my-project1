import { CH, DOWN, NAMES } from "./constants";
import { emptyFilters, linksActive, picked, toggleCity, toggleGame, toggleLink, type Filters } from "./filter";
import { ico } from "./icons";
import type { Model } from "./model";
import type { Runtime } from "./runtime";
import { esc, formatCount, norm } from "./text";

function colLabel(key: string): string {
  return key === "games" ? "Cards" : key === "links" ? "Links" : "Location";
}

function colOn(rt: Runtime, key: string): boolean {
  if (key === "links") return linksActive(rt.active);
  if (key === "games") return rt.known || picked(rt.games).length > 0;
  return picked(rt.city).length > 0;
}

function selectionCount(rt: Runtime, key: string): number {
  if (key === "links") return CH.filter((channel) => rt.active[channel.k]).length;
  if (key === "games") return picked(rt.games).length + (rt.known ? 1 : 0);
  return picked(rt.city).length;
}

function headLabel(rt: Runtime, key: string, on: boolean, count: number): string {
  const name = colLabel(key);
  if (!on) return name;
  if (key === "links" && count > 1) return `${name}, ${count} selected, shop needs every one`;
  if (key === "games" && rt.known && !picked(rt.games).length) return `${name}, cards known`;
  return `${name}, ${count} selected`;
}

function knownShops(rt: Runtime): number {
  let count = 0;
  for (const entry of rt.model.entries) if (entry.locs.some((location) => location.gameList.length)) count++;
  return count;
}

function clearColumnFilters(rt: Runtime): void {
  for (const key of Object.keys(rt.games)) delete rt.games[key];
  for (const key of Object.keys(rt.city)) delete rt.city[key];
  for (const key of Object.keys(rt.active)) delete rt.active[key];
  rt.known = false;
}

/** `in` is `p:ON` or `m:ON|Toronto`. A municipality has to be one the catalog lists. */
function acceptedPlace(value: string, model: Model): boolean {
  if (/^p:[A-Z]{2}$/.test(value)) return !!NAMES[value.slice(2)];
  const match = /^m:([A-Z]{2})\|(.+)$/.exec(value);
  if (!match) return false;
  const province = match[1] ?? "";
  const muni = match[2] ?? "";
  return !!NAMES[province] && (model.munisOf[province] ?? []).includes(muni);
}

/** Query keys: `g` game id, `in` place, `link` channel, `known=1`. */
export function readFilters(search: string, model: Model): Filters {
  const params = new URLSearchParams(search);
  const filters = emptyFilters();
  for (const id of params.getAll("g")) if (model.gamesById[id]) filters.games[id] = true;
  filters.known = params.get("known") === "1";
  for (const key of params.getAll("in")) if (acceptedPlace(key, model)) filters.city[key] = true;
  for (const key of params.getAll("link")) if (CH.some((channel) => channel.k === key)) filters.active[key] = true;
  return filters;
}

export function writeFilters(params: URLSearchParams, filters: Filters): void {
  if (filters.known) params.set("known", "1");
  for (const id of picked(filters.games)) params.append("g", id);
  for (const key of picked(filters.city)) params.append("in", key);
  for (const channel of CH) if (filters.active[channel.k]) params.append("link", channel.k);
}

function optBtn(
  value: string,
  label: string,
  icon: string | null,
  color: string | null,
  selected: boolean,
  showing: boolean,
  cls = "",
  extra = "",
  disabled = false,
): string {
  return `<button type="button" class="copt${showing ? "" : " off"}${cls ? ` ${cls}` : ""}" data-v="${esc(value)}" aria-pressed="${selected}"${disabled ? " disabled" : ""}>${icon ? ico(icon, showing ? color : null, 16) : ""}<span class="cl">${label}</span>${extra}</button>`;
}

function cityMenu(rt: Runtime, find: string): string {
  const all = !colOn(rt, "city");
  const query = find ? norm(find).trim() : "";
  const hit = (text: string) => norm(text).includes(query);
  let html = "";
  for (const province of rt.model.provs) {
    const provinceName = NAMES[province] || province;
    const selected = !!rt.city[`p:${province}`];
    const munis = rt.model.munisOf[province] ?? [];
    const match: { m: string; via: string }[] = [];
    if (query) {
      for (const muni of munis) {
        const communities = Object.keys(rt.model.commsOf[`${province}|${muni}`] ?? {}).filter((community) => community !== muni);
        if (hit(muni)) match.push({ m: muni, via: "" });
        else {
          const via = communities.filter(hit);
          if (via.length) match.push({ m: muni, via: via.join(", ") });
        }
      }
    }
    if (query && !hit(provinceName) && !match.length) continue;
    const hasMuni = munis.some((muni) => rt.city[`m:${province}|${muni}`]);
    const open = rt.openProv[province] !== undefined ? rt.openProv[province] : hasMuni;
    const rows = match.length ? match : open ? munis.map((muni) => ({ m: muni, via: "" })) : [];
    html +=
      `<div class="cgrp">${optBtn(`p:${province}`, esc(provinceName), null, null, selected, all || selected, "prov")}` +
      `<button type="button" class="cexp" data-x="${province}" aria-expanded="${rows.length > 0}" aria-label="Municipalities in ${esc(provinceName)}">${DOWN}</button></div>` +
      rows
        .map((row) => {
          const key = `m:${province}|${row.m}`;
          const on = !!rt.city[key];
          const hint = row.via ? `<span class="hint">${esc(row.via)}</span>` : "";
          return optBtn(
            key,
            `${esc(row.m)}${hint}`,
            null,
            null,
            on,
            all || selected || on,
            "muni",
            `<span class="cn">${formatCount(rt.model.mcount[`${province}|${row.m}`] ?? 0)}</span>`,
          );
        })
        .join("");
  }
  return html || '<p class="cnone">No province, municipality or community matches.</p>';
}

function menuHtml(rt: Runtime, key: string, find: string): string {
  if (key === "links") {
    const all = !linksActive(rt.active);
    const note = '<p class="cnote">A shop needs every link you pick.</p>';
    return (
      note +
      CH.map((channel) =>
        optBtn(channel.k, esc(channel.label), channel.i, channel.c, !!rt.active[channel.k], all || !!rt.active[channel.k]),
      ).join("")
    );
  }
  if (key === "games") {
    const all = !colOn(rt, "games");
    const known = optBtn(
      "known",
      esc("Cards known"),
      null,
      null,
      rt.known,
      all || rt.known,
      "known",
      `<span class="cn">${formatCount(knownShops(rt))}</span>`,
    );
    const games = rt.model.games
      .map((game) => {
        const selected = !!rt.games[game.id];
        const count = rt.model.gcount[game.id] ?? 0;
        const name = `${game.name !== game.short ? `<span data-tip="${esc(game.name)}">` : "<span>"}${esc(game.short)}</span>`;
        return optBtn(
          game.id,
          name,
          null,
          null,
          selected,
          all || selected,
          "",
          `<span class="cn">${formatCount(count)}</span>`,
          !count && !selected,
        );
      })
      .join("");
    return known + games;
  }
  return cityMenu(rt, find);
}

export function initColumns(rt: Runtime): void {
  function fillPop(): void {
    if (!rt.openCol) return;
    const box = rt.cpop.querySelector(".copts");
    const find = rt.cpop.querySelector(".cfind");
    if (!(box instanceof HTMLElement)) return;
    const query = find instanceof HTMLInputElement ? find.value.trim() : "";
    const active = document.activeElement;
    const scroll = box.scrollTop;
    let keep: [string, string | null] | null = null;
    if (active instanceof HTMLElement && box.contains(active)) {
      keep = active.hasAttribute("data-x")
        ? ["data-x", active.getAttribute("data-x")]
        : ["data-v", active.getAttribute("data-v")];
    }
    box.innerHTML = menuHtml(rt, rt.openCol, query);
    rt.dropStaleTip();
    box.scrollTop = scroll;
    if (!keep) return;
    const [attr, value] = keep;
    for (const button of box.querySelectorAll<HTMLElement>(`[${attr}]`)) {
      if (button.getAttribute(attr) === value) {
        button.focus();
        break;
      }
    }
  }

  function closePop(refocus: boolean): void {
    if (!rt.openCol) return;
    const anchor = rt.anchor;
    rt.openCol = null;
    rt.anchor = null;
    rt.cpop.hidden = true;
    rt.cpop.innerHTML = "";
    rt.dropStaleTip();
    rt.syncHead();
    if (refocus && anchor && document.contains(anchor)) anchor.focus();
  }

  function placePop(): void {
    if (!rt.openCol || !rt.anchor) return;
    const box = rt.anchor.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    rt.cpop.style.top = `${Math.round(box.bottom + window.scrollY + 8)}px`;
    rt.cpop.style.left = `${Math.round(Math.min(Math.max(8, box.left - 6), width - rt.cpop.offsetWidth - 8) + window.scrollX)}px`;
  }

  function openPop(key: string): void {
    if (rt.openCol === key) {
      closePop(true);
      return;
    }
    closePop(false);
    rt.openCol = key;
    const anchor = rt.head.querySelector(`[data-col="${key}"]`);
    rt.anchor = anchor instanceof HTMLElement ? anchor : null;
    rt.cpop.className = `cpop cpop-${key}`;
    rt.cpop.setAttribute("aria-label", `Filter by ${colLabel(key).toLowerCase()}`);
    const find =
      key === "city"
        ? '<input class="cfind" type="text" autocomplete="off" spellcheck="false" placeholder="Find a place" aria-label="Find a province, municipality or community">'
        : "";
    rt.cpop.innerHTML = `${find}<div class="copts" role="group"></div>`;
    rt.cpop.hidden = false;
    fillPop();
    placePop();
    rt.syncHead();
    const first = rt.cpop.querySelector("input, .copt");
    if (first instanceof HTMLElement) first.focus();
  }

  rt.drawHead = () => {
    rt.head.innerHTML =
      '<span class="hlab">Store<button type="button" class="hclear" hidden>Clear filters</button></span>' +
      ["games", "city", "links"]
        .map(
          (key) =>
            `<button type="button" class="hbtn" data-col="${key}" aria-haspopup="dialog" aria-expanded="false"><span>${colLabel(key)}</span><span class="hb" hidden></span>${DOWN}</button>`,
        )
        .join("");
  };
  rt.syncHead = () => {
    rt.head.querySelectorAll<HTMLButtonElement>(".hbtn").forEach((button) => {
      const key = button.getAttribute("data-col") ?? "";
      const on = colOn(rt, key);
      const badge = button.querySelector(".hb");
      const count = selectionCount(rt, key);
      button.classList.toggle("on", on);
      button.setAttribute("aria-expanded", String(rt.openCol === key));
      button.setAttribute("aria-label", headLabel(rt, key, on, count));
      if (badge instanceof HTMLElement) {
        badge.hidden = !on;
        badge.textContent = on ? String(count) : "";
      }
    });
    const clear = rt.head.querySelector(".hclear");
    if (clear instanceof HTMLButtonElement) {
      const on = colOn(rt, "games") || colOn(rt, "city") || colOn(rt, "links");
      clear.hidden = !on;
      clear.setAttribute("aria-label", "Clear cards, place and links");
    }
  };
  rt.closePop = closePop;
  rt.fillPop = fillPop;
  rt.placePop = placePop;

  rt.head.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".hclear")) {
      clearColumnFilters(rt);
      rt.render();
      const next = rt.head.querySelector(".hbtn");
      if (next instanceof HTMLElement) next.focus();
      return;
    }
    const button = target?.closest(".hbtn");
    if (button) openPop(button.getAttribute("data-col") ?? "");
  });
  rt.cpop.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const expander = target?.closest(".cexp");
    if (expander instanceof HTMLElement) {
      rt.openProv[expander.getAttribute("data-x") ?? ""] = expander.getAttribute("aria-expanded") !== "true";
      fillPop();
      placePop();
      return;
    }
    const button = target?.closest(".copt");
    if (!(button instanceof HTMLButtonElement) || !rt.openCol || button.disabled) return;
    const value = button.getAttribute("data-v") ?? "";
    if (rt.openCol === "links") toggleLink(rt.active, value);
    else if (rt.openCol === "city") toggleCity(rt.city, value);
    else if (value === "known") rt.known = !rt.known;
    else toggleGame(rt.games, value);
    rt.render();
  });
  rt.cpop.addEventListener("input", () => fillPop());
  rt.cpop.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closePop(true);
  });
  rt.cpop.addEventListener("focusout", (event) => {
    const to = event.relatedTarget;
    if (to instanceof Node && !rt.cpop.contains(to) && to !== rt.anchor) closePop(false);
  });
  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (rt.openCol && !rt.cpop.contains(target) && !(rt.anchor && rt.anchor.contains(target))) closePop(false);
  });
  window.addEventListener("resize", placePop);
}
