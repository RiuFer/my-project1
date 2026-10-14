import { MAIN, STATUS } from "./constants";
import { linksActive, picked, searchHitsYield, type Hit } from "./filter";
import { linkIcons } from "./markup";
import type { Runtime } from "./runtime";
import { esc, formatCount } from "./text";
import { whereText } from "./where";

function chips(rt: Runtime, hit: Hit): string {
  if (!hit.games.length)
    return '<span class="gm"><span class="nog" aria-hidden="true">\u2014</span><span class="sr">Cards not known yet.</span></span>';
  const selected = picked(rt.games);
  const isMain = (id: string) => MAIN.includes(id);
  const hits = hit.games.filter((id) => selected.includes(id));
  const main = hit.games
    .filter((id) => isMain(id) && !hits.includes(id))
    .sort((a, b) => MAIN.indexOf(a) - MAIN.indexOf(b));
  const rest = hit.games.filter((id) => !isMain(id) && !hits.includes(id));
  const all = hits.concat(hit.games.filter((id) => !hits.includes(id)));
  const name = (id: string) => rt.model.gamesById[id]?.name ?? id;
  const short = (id: string) => rt.model.gamesById[id]?.short ?? id;
  const shown = hits
    .concat(main)
    .map((id) => `<span class="chip${hits.includes(id) ? " hit" : ""}" title="${esc(name(id))}">${esc(short(id))}</span>`)
    .join("");
  const more = rest.length ? `<span class="chip more" data-games="${esc(rest.join(" "))}">+${rest.length}</span>` : "";
  return `<span class="gm">${shown}${more}<span class="sr">Cards: ${esc(all.map(name).join(", "))}.</span></span>`;
}

function rowHtml(rt: Runtime, hit: Hit, index: number): string {
  const status = STATUS[hit.main.status];
  return `<div class="item" data-k="${index}"><span class="nm"><button type="button" class="nmbtn">${esc(hit.e.name)}</button></span><span class="meta">${chips(rt, hit)}<span class="pv">${esc(whereText(hit.m))}${status ? `<span class="st">${esc(status)}</span>` : ""}</span>${linkIcons(hit.main, rt.coarse)}</span></div>`;
}

/** Rows inserted before yielding, so the first paint is not one long task. */
const SLICE = 12;

function later(run: () => void): void {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) {
    void scheduler.yield().then(run);
    return;
  }
  setTimeout(run, 0);
}

export function initList(rt: Runtime): void {
  const sentinel = document.getElementById("sentinel");
  let ticking = false;
  let fillToken = 0;
  let renderToken = 0;

  function fillRows(): void {
    if (!sentinel) return;
    const token = ++fillToken;
    let added = 0;
    const step = (): void => {
      if (token !== fillToken || !sentinel) return;
      if (rt.shown >= rt.list.length || added >= 500) return;
      const limit = window.innerHeight + 1000;
      if (rt.shown > 0 && sentinel.getBoundingClientRect().top >= limit) return;
      const next = rt.list.slice(rt.shown, rt.shown + SLICE);
      if (!next.length) return;
      rt.out.insertAdjacentHTML(
        "beforeend",
        next.map((hit, index) => rowHtml(rt, hit, rt.shown + index)).join(""),
      );
      rt.shown += next.length;
      added += next.length;
      if (rt.shown < rt.list.length && added < 500 && sentinel.getBoundingClientRect().top < limit) later(step);
    };
    later(step);
  }

  function onScroll(): void {
    if (ticking || rt.shown >= rt.list.length) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      fillRows();
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  rt.render = () => {
    const token = ++renderToken;
    const terms = rt.termsNow();
    const filters = { games: rt.games, city: rt.city, active: rt.active, known: rt.known };
    rt.hideTip(true);
    rt.syncHead();
    if (rt.openCol) {
      rt.fillPop();
      rt.placePop();
    }
    void searchHitsYield(rt.model, terms, filters, () => token !== renderToken).then((hits) => {
      if (!hits || token !== renderToken) return;
      rt.list = hits;
      const narrowing = terms.some((term) => term.length > 1);
      const filtered =
        narrowing || filters.known || picked(filters.games).length > 0 || picked(filters.city).length > 0 || linksActive(filters.active);
      const title = document.getElementById("regionTitle");
      if (title) {
        const count = filtered
          ? `${formatCount(rt.list.length)} of ${formatCount(rt.model.entries.length)}`
          : formatCount(rt.model.entries.length);
        if (title.dataset.count !== count) {
          title.dataset.count = count;
          title.innerHTML = `TCG Canada<span>${count}</span>`;
        }
      }
      clearTimeout(rt.announce);
      rt.announce = setTimeout(() => {
        if (token !== renderToken) return;
        rt.live.textContent = rt.list.length
          ? `${formatCount(rt.list.length)}${rt.list.length === 1 ? " shop" : " shops"}`
          : "No shops";
      }, 400);
      rt.shown = 0;
      rt.out.innerHTML = rt.list.length
        ? ""
        : `<p class="empty">${rt.model.entries.length ? "No shops match these filters." : "No shops are listed yet."}</p>`;
      fillRows();
    });
  };

  rt.out.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const menuButton = target.closest("button.lk");
    if (menuButton instanceof HTMLElement) {
      if (rt.tipPinned && rt.tipFor === menuButton) rt.hideTip(true);
      else rt.showMenu(menuButton, true, event.detail === 0 ? "first" : "");
      return;
    }
    const more = target.closest(".chip.more");
    if (more instanceof HTMLElement) {
      if (rt.tipPinned && rt.tipFor === more) rt.hideTip(true);
      else rt.showList(more, true);
      return;
    }
    const copyLink = target.closest("a.lk[data-val]");
    if (copyLink instanceof HTMLElement && !rt.coarse) {
      event.preventDefault();
      const value = copyLink.getAttribute("data-val") ?? "";
      void rt.copyText(value).then((ok) => {
        rt.flashTip(copyLink, ok ? `Copied ${value}` : `Couldn't copy ${value}`, ok);
        clearTimeout(rt.announce);
        rt.live.textContent = ok ? `Copied ${value}` : `Couldn't copy ${value}`;
      });
      return;
    }
    if (target.closest("a")) return;
    const row = target.closest(".item");
    if (!(row instanceof HTMLElement)) return;
    const hit = rt.list[Number(row.getAttribute("data-k"))];
    if (!hit) return;
    const nameButton = row.querySelector(".nmbtn");
    rt.lastFocus = nameButton instanceof HTMLElement ? nameButton : null;
    rt.focusFromClick = true;
    if (location.hash.slice(1) === hit.main.id) {
      rt.route();
      return;
    }
    rt.pushedStore = true;
    location.hash = hit.main.id;
  });
}
