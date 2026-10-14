import { initColumns, readFilters, writeFilters } from "./columns";
import { initDialog } from "./dialog";
import { initList } from "./list";
import type { Model } from "./model";
import { createRuntime, type Runtime } from "./runtime";
import { initSearch, readQueryText, writeQueryText } from "./search";
import { day } from "./text";
import { initTooltips } from "./tooltips";

function applyLocation(rt: Runtime): void {
  const filters = readFilters(location.search, rt.model);
  rt.games = filters.games;
  rt.city = filters.city;
  rt.active = filters.active;
  rt.known = filters.known;
  rt.q.value = readQueryText(location.search);
}

let shownSearch = "";

function persistLocation(rt: Runtime): void {
  const params = new URLSearchParams();
  writeQueryText(params, rt.q.value);
  writeFilters(params, { games: rt.games, city: rt.city, active: rt.active, known: rt.known });
  const search = params.toString();
  const next = `${location.pathname}${search ? `?${search}` : ""}${location.hash}`;
  if (next !== `${location.pathname}${location.search}${location.hash}`) {
    try {
      history.replaceState(null, "", next);
    } catch {
      /* the list is already showing the filters */
    }
  }
  shownSearch = location.search;
}

export function start(model: Model): void {
  const runtime = createRuntime(model);
  initSearch(runtime);
  initColumns(runtime);
  initList(runtime);
  initDialog(runtime);
  initTooltips(runtime);
  runtime.q.placeholder = "Search";
  const updated = model.updated ? `Last updated ${day(model.updated)}` : "";
  if (runtime.updated.textContent !== updated) runtime.updated.textContent = updated;
  applyLocation(runtime);
  runtime.drawHead();
  const render = runtime.render;
  runtime.render = () => {
    render();
    persistLocation(runtime);
  };
  runtime.setSearch(runtime.wide.matches || !!runtime.q.value.trim(), false);
  runtime.render();
  runtime.route();
  // Back restores an older query. A shop hash uses the same search, so closing it does not rebuild the list.
  window.addEventListener("popstate", () => {
    if (location.search === shownSearch) return;
    setTimeout(() => {
      applyLocation(runtime);
      runtime.setSearch(runtime.wide.matches || runtime.searchOpen || !!runtime.q.value.trim(), false);
      runtime.render();
    }, 0);
  });
}
