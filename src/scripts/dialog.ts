import { addrOneLine, mapsHref, socialParts, streetLine, telHref } from "./channels";
import { DOWN, SOURCE, STATUS } from "./constants";
import { ico } from "./icons";
import type { Fact, Location } from "./model";
import type { Runtime } from "./runtime";
import { day, esc, formatCount, host, month, toHttps } from "./text";
import { whereText } from "./where";

function copyBtn(value: string, what: string): string {
  return `<button type="button" class="cbtn" data-copy="${esc(value)}" aria-label="Copy ${what}" data-tip="Copy ${what}">${ico("copy", null, 16)}</button>`;
}

function prow(icon: string, color: string | null, label: string, values: string): string {
  return `<div class="prow"><div class="rl">${ico(icon, color)}<span class="rt">${label}</span></div><div class="rv">${values}</div></div>`;
}

function vline(inner: string, copy = ""): string {
  return `<div class="vl">${inner}${copy}</div>`;
}

function linkHtml(text: string, href: string): string {
  const local = /^(tel|mailto):/.test(href);
  return `<a href="${esc(href)}"${local ? "" : ' target="_blank" rel="noopener"'}>${esc(text)}</a>`;
}

function webLabel(values: string[], index: number): string {
  const hosts = values.map((value) => host(toHttps(value)));
  let name = hosts[index] ?? "";
  if (hosts.indexOf(name) !== hosts.lastIndexOf(name)) {
    try {
      name += new URL(toHttps(values[index] ?? "")).pathname.replace(/\/+$/, "");
    } catch {
      /* host is enough */
    }
  }
  return name;
}

function gameRows(rt: Runtime, location: Location): string {
  const chips = (ids: string[]) =>
    `<div class="gchips">${ids.map((id) => `<span class="chip">${esc(rt.model.gamesById[id]?.name ?? id)}</span>`).join("")}</div>`;
  if (!location.sells.length && !location.hosts.length)
    return prow("cards", null, "Cards", '<div class="vl nol"><span>No cards listed yet</span></div>');
  return (
    (location.sells.length ? prow("cards", null, "Sells", chips(location.sells)) : "") +
    (location.hosts.length ? prow("cal", null, "Hosts events", chips(location.hosts)) : "")
  );
}

function contactRows(location: Location): string {
  let html = "";
  if (location.street || location.community) {
    const cityProv = [location.community, location.prov].filter(Boolean).join(" ");
    const line2 =
      esc(cityProv) + (location.postal ? `${cityProv ? "&nbsp; " : ""}<span class="nowrap">${esc(location.postal)}</span>` : "");
    const addr = [streetLine(location) ? esc(streetLine(location)) : "", line2].filter(Boolean).join("<br>");
    html += prow(
      "pin",
      "--c-maps",
      "Address",
      vline(
        location.ch.maps
          ? `<a href="${esc(mapsHref(location))}" target="_blank" rel="noopener" data-tip="Open in Google Maps">${addr}</a>`
          : `<span>${addr}</span>`,
        location.street ? copyBtn(addrOneLine(location), "address") : "",
      ) +
        (location.community !== location.muni ? `<div class="vnote">${esc(location.muni)}</div>` : "") +
        (location.note ? `<div class="vnote">${esc(location.note)}</div>` : ""),
    );
  }
  if (location.ch.phone.length)
    html += prow(
      "phone",
      "--c-phone",
      "Phone",
      location.ch.phone.map((phone) => vline(linkHtml(phone, telHref(phone)), copyBtn(phone, "phone number"))).join(""),
    );
  if (location.ch.email.length)
    html += prow(
      "mail",
      "--c-email",
      "Email",
      location.ch.email.map((email) => vline(linkHtml(email, `mailto:${email}`), copyBtn(email, "email"))).join(""),
    );
  return html;
}

function onlineRows(location: Location): string {
  const web = location.ch.web;
  const social = location.ch.social;
  const sites = web.length
    ? prow(
        "globe",
        "--c-web",
        "Website",
        web
          .map((url, index) => {
            const https = toHttps(url);
            return vline(linkHtml(webLabel(web, index), https), copyBtn(https, "website"));
          })
          .join(""),
      )
    : "";
  const profiles = social.length
    ? prow(
        "social",
        "--c-social",
        "Social",
        social
          .map((url) => {
            const parts = socialParts(url);
            const label = esc(parts[0] || parts[1]);
            const handle = parts[0] && parts[1] ? ` <span class="vh">${esc(parts[1])}</span>` : "";
            return vline(
              `<a href="${esc(url)}" target="_blank" rel="noopener">${label}${handle}</a>`,
              copyBtn(url, `${parts[0] || "social"} link`),
            );
          })
          .join(""),
      )
    : "";
  return sites + profiles;
}

function factHtml(fact: Fact): string {
  const label = SOURCE[fact.source] || fact.source;
  const when = fact.date ? `dated ${day(fact.date)}, seen ${day(fact.seen)}` : `seen ${day(fact.seen)}`;
  const note = fact.note.startsWith(`${label}: `) ? fact.note.slice(label.length + 2) : fact.note;
  const where = fact.url
    ? `<a href="${esc(fact.url)}" target="_blank" rel="noopener">${esc(label)} (${esc(host(fact.url))})</a>`
    : `<span>${esc(label)}</span>`;
  return `<div class="sf"><span class="sk">${fact.kind === "sells" ? "Sells" : "Hosts events"}</span><div>${where}<span class="sd">, ${esc(when)}</span>${note ? `<div class="sn">${esc(note)}</div>` : ""}</div></div>`;
}

function locLabel(location: Location): string {
  const base = location.branch || location.community;
  return location.name !== location.entry.name
    ? location.name + (base && !location.name.includes(base) ? ` · ${base}` : "")
    : base || location.name;
}

function sourcesHtml(rt: Runtime, locations: Location[], multi: boolean): string {
  let latest = "";
  for (const location of locations) {
    for (const date of [location.checked, ...location.facts.map((fact) => fact.seen)]) {
      if (date && date > latest) latest = date;
    }
  }
  const body = locations
    .map((location) => {
      const by: Record<string, Fact[]> = {};
      const order: string[] = [];
      const facts = location.facts.slice().sort((a, b) => {
        return (rt.model.gamesById[a.game]?.rank ?? 0) - (rt.model.gamesById[b.game]?.rank ?? 0) || (a.kind < b.kind ? 1 : -1);
      });
      for (const fact of facts) {
        if (!by[fact.game]) {
          by[fact.game] = [];
          order.push(fact.game);
        }
        by[fact.game]?.push(fact);
      }
      const items = order
        .map((id) => {
          const rows = (by[id] ?? []).map((fact) => factHtml(fact)).join("");
          return `<li><div class="sg">${esc(rt.model.gamesById[id]?.name ?? id)}</div>${rows}</li>`;
        })
        .join("");
      return `${multi ? `<h5>${esc(locLabel(location))}</h5>` : ""}<ul>${items}</ul>`;
    })
    .join("");
  const checked = latest ? `<span class="lc">Last checked ${esc(month(latest))}</span>` : "";
  return `<details class="src"><summary>${DOWN}<span>Sources</span>${checked}</summary><div class="sbody">${body}</div></details>`;
}

function sig(location: Location, what: string): string {
  return what === "games"
    ? `${location.sells.join()}|${location.hosts.join()}`
    : `${location.ch.web.join()}|${location.ch.social.join()}`;
}

function fill(rt: Runtime, entry: Location["entry"], locations: Location[], hereId: string): void {
  const multi = locations.length > 1;
  const one = locations[0];
  if (!one) return;
  const sameGames = locations.every((location) => sig(location, "games") === sig(one, "games"));
  const sameOnline = multi && locations.every((location) => sig(location, "online") === sig(one, "online"));
  const badge = (location: Location) => (STATUS[location.status] ? `<span class="badge">${esc(STATUS[location.status])}</span>` : "");
  const where = whereText([one]);
  const name = document.getElementById("popName");
  const kind = document.getElementById("popKind");
  const body = document.getElementById("popBody");
  if (name) name.textContent = entry.name;
  if (kind) {
    kind.innerHTML = multi
      ? `<span>${formatCount(locations.length)} locations</span>`
      : [one.name !== entry.name ? one.name : "", where !== "—" ? where : ""]
          .filter(Boolean)
          .map((text) => `<span>${esc(text)}</span>`)
          .join("") + badge(one);
  }
  let html = sameGames ? `<section class="psec">${gameRows(rt, one)}</section>` : "";
  const shared = sameOnline ? onlineRows(one) : "";
  if (shared) html += `<section class="psec">${shared}</section>`;
  html += locations
    .map((location) => {
      const here = multi && location.id === hereId;
      const head = multi
        ? `<h4>${esc(locLabel(location))}${badge(location)}${here ? '<span class="sr"> (the location you followed a link to)</span>' : ""}</h4>`
        : "";
      const rows = (sameGames ? "" : gameRows(rt, location)) + contactRows(location) + (sameOnline ? "" : onlineRows(location));
      return head || rows ? `<section class="psec loc" data-id="${esc(location.id)}">${head}${rows}</section>` : "";
    })
    .join("");
  const known = locations.filter((location) => location.facts.length);
  if (known.length) html += sourcesHtml(rt, known, multi);
  if (body) body.innerHTML = html;
}

function showOverlay(rt: Runtime): void {
  rt.overlay.hidden = false;
  document.body.classList.add("locked");
  const body = document.getElementById("popBody");
  if (body) body.scrollTop = 0;
  rt.hintsReady = false;
  const pop = rt.overlay.querySelector(".pop");
  if (pop instanceof HTMLElement) pop.focus();
}

function rememberFocus(rt: Runtime): void {
  if (rt.overlay.hidden && !rt.focusFromClick && document.activeElement instanceof HTMLElement) rt.lastFocus = document.activeElement;
  rt.focusFromClick = false;
}

function openEntry(rt: Runtime, entry: Location["entry"], firstId: string): void {
  const key = `${entry.i}|${firstId}`;
  if (rt.openKey === key && !rt.overlay.hidden) return;
  rt.closePop(false);
  rt.hideTip(true);
  rememberFocus(rt);
  rt.openKey = key;
  const first = rt.model.locsById[firstId];
  if (!first) return;
  const locations = [first, ...entry.locs.filter((location) => location !== first)];
  fill(rt, entry, locations, firstId);
  showOverlay(rt);
}

function showGone(rt: Runtime, known: boolean): void {
  rt.closePop(false);
  rememberFocus(rt);
  rt.openKey = "gone";
  const name = document.getElementById("popName");
  const kind = document.getElementById("popKind");
  const body = document.getElementById("popBody");
  if (name) name.textContent = known ? "This shop is no longer listed" : "Shop not found";
  if (kind) kind.textContent = "";
  if (body) {
    body.innerHTML =
      '<section class="psec gone"><p>' +
      (known
        ? "It may have closed or moved, or there is no current source showing which trading card games it sells or hosts events for."
        : "This link doesn't match a shop in the list.") +
      '</p><button type="button" class="back" data-close>Browse all shops</button></section>';
  }
  showOverlay(rt);
}

function resolveId(hash: string, redirects: Record<string, string>): string {
  let id = hash;
  let hops = 0;
  while (redirects[id] && hops++ < 10) id = redirects[id] ?? id;
  return id;
}

export function initDialog(rt: Runtime): void {
  function hideStore(): void {
    if (rt.overlay.hidden) return;
    rt.overlay.hidden = true;
    rt.hideTip(true);
    rt.openKey = "";
    document.body.classList.remove("locked");
    if (rt.lastFocus && document.contains(rt.lastFocus)) rt.lastFocus.focus();
    rt.lastFocus = null;
  }

  function requestClose(): void {
    if (rt.pushedStore) {
      rt.pushedStore = false;
      history.back();
      return;
    }
    try {
      history.replaceState(null, "", location.href.replace(/#.*$/, ""));
    } catch {
      location.hash = "";
    }
    hideStore();
  }

  function route(): void {
    const raw = decodeURIComponent(location.hash.slice(1));
    if (!raw) {
      rt.pushedStore = false;
      hideStore();
      return;
    }
    const id = resolveId(raw.replace(/^[A-Za-z]{2}[~.]/, ""), rt.model.redirects);
    const shop = rt.model.locsById[id];
    if (shop) {
      if (id !== raw) {
        try {
          history.replaceState(null, "", `${location.pathname}${location.search}#${id}`);
        } catch {
          /* the typed hash still opens the shop */
        }
      }
      openEntry(rt, shop.entry, id);
    } else showGone(rt, !!rt.model.retired[id]);
  }

  rt.hideStore = hideStore;
  rt.requestClose = requestClose;
  rt.route = route;
  window.addEventListener("hashchange", route);

  const close = document.getElementById("close");
  close?.addEventListener("click", requestClose);
  rt.overlay.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target === rt.overlay || target.closest("[data-close]")) {
      requestClose();
      return;
    }
    const tel = target.closest('a[href^="tel:"], a[href^="mailto:"]');
    if (tel && !rt.coarse) {
      const copy = tel.parentElement?.querySelector("[data-copy]");
      if (copy instanceof HTMLElement) {
        event.preventDefault();
        copy.click();
      }
      return;
    }
    const button = target.closest("[data-copy]");
    if (!(button instanceof HTMLElement)) return;
    const old = button.innerHTML;
    const isText = button.classList.contains("clink");
    const flash = (html: string, cls: string) => {
      button.innerHTML = html;
      button.classList.add(cls);
      setTimeout(() => {
        button.innerHTML = old;
        button.classList.remove(cls);
      }, 1600);
    };
    const done = () => flash(isText ? `${ico("check", null, 14)}<span>Copied</span>` : ico("check", null, 16), "ok");
    const fallback = () => {
      const text = button.parentElement?.querySelector("a, span");
      const selection = window.getSelection();
      if (text && selection) {
        const range = document.createRange();
        range.selectNodeContents(text);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      if (isText) flash(`${ico("copy", null, 14)}<span>Press Ctrl+C</span>`, "warn");
      else {
        button.setAttribute("data-tip", "Press Ctrl+C to copy");
        rt.showTip(button, true);
      }
    };
    const value = button.getAttribute("data-copy") ?? "";
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(value).then(done, fallback);
    else fallback();
  });
  document.addEventListener("keydown", (event) => {
    if (rt.overlay.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...rt.overlay.querySelectorAll<HTMLElement>("button, a[href], summary")].filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const pop = rt.overlay.querySelector(".pop");
    if (event.shiftKey && (document.activeElement === first || document.activeElement === pop)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
