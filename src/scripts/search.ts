import type { Runtime } from "./runtime";
import { termsFrom } from "./text";

/** The search box, stored as `q` so a refresh keeps what was typed. */
export function readQueryText(search: string): string {
  return new URLSearchParams(search).get("q") ?? "";
}

export function writeQueryText(params: URLSearchParams, value: string): void {
  const text = value.trim();
  if (text) params.set("q", text);
}

export function initSearch(rt: Runtime): void {
  let typing: ReturnType<typeof setTimeout> | undefined;

  function syncSearchIcon(): void {
    const showX = rt.searchOpen && (!!rt.q.value || !rt.wide.matches);
    rt.sbox.classList.toggle("x", showX);
    rt.sbtn.setAttribute("aria-label", showX ? (rt.q.value ? "Clear search" : "Close search") : "Search");
  }

  function setSearch(open: boolean, focus = false): void {
    rt.searchOpen = open;
    rt.sbox.classList.toggle("open", open);
    rt.sbtn.setAttribute("aria-expanded", String(open));
    rt.q.tabIndex = open ? 0 : -1;
    if (open && focus) rt.q.focus();
    if (!open && rt.q.value) {
      rt.q.value = "";
      rt.render();
    }
    syncSearchIcon();
  }

  rt.setSearch = setSearch;
  rt.termsNow = () => termsFrom(rt.q.value);

  rt.q.addEventListener("input", () => {
    syncSearchIcon();
    clearTimeout(typing);
    typing = setTimeout(() => rt.render(), 150);
  });
  rt.sbtn.addEventListener("click", () => {
    if (!rt.searchOpen) {
      setSearch(true, true);
      return;
    }
    if (rt.q.value) {
      rt.q.value = "";
      syncSearchIcon();
      rt.render();
      rt.q.focus();
      return;
    }
    if (!rt.wide.matches) {
      setSearch(false);
      rt.sbtn.focus();
      return;
    }
    rt.q.focus();
  });
  rt.q.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !rt.overlay.hidden) return;
    if (rt.q.value) {
      rt.q.value = "";
      syncSearchIcon();
      rt.render();
    } else if (!rt.wide.matches) {
      setSearch(false);
      rt.sbtn.focus();
    }
  });
  // The search box is the main action: open by default on wider screens.
  rt.wide.addEventListener("change", () => {
    if (rt.wide.matches && !rt.searchOpen) setSearch(true, false);
    else syncSearchIcon();
  });
}
