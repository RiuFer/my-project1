import { ico } from "./icons";
import { socialLineHtml, valueMenuHtml } from "./markup";
import type { Runtime } from "./runtime";
import { esc } from "./text";

const copied = new WeakMap<HTMLElement, { html: string; timer?: ReturnType<typeof setTimeout> }>();

function copyText(text: string): Promise<boolean> {
  const legacy = () => {
    const field = document.createElement("textarea");
    let ok = false;
    const active = document.activeElement;
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "0";
    field.style.left = "0";
    field.style.opacity = "0";
    field.style.pointerEvents = "none";
    document.body.appendChild(field);
    field.select();
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(field);
    if (active instanceof HTMLElement) active.focus({ preventScroll: true });
    return ok;
  };
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, legacy);
  return Promise.resolve(legacy());
}

export function initTooltips(rt: Runtime): void {
  function tipMode(kind: string, label?: string): void {
    if (rt.tipFor) {
      if (rt.tipMenu) rt.tipFor.setAttribute("aria-expanded", "false");
      rt.tipFor.classList.remove("open");
    }
    rt.tipMenu = kind === "menu";
    rt.tipPinned = false;
    rt.tip.className = `tip${kind === "label" ? "" : ` ${kind}`}`;
    rt.tip.setAttribute("role", rt.tipMenu ? "menu" : "tooltip");
    if (rt.tipMenu) rt.tip.setAttribute("aria-label", label ?? "");
    else rt.tip.removeAttribute("aria-label");
  }

  function placeTip(anchor: HTMLElement): void {
    rt.tip.classList.remove("wrap", "up", "down");
    rt.tip.style.left = "0px";
    rt.tip.style.top = "0px";
    rt.tip.hidden = false;
    if (!rt.tipMenu && rt.tip.scrollWidth > rt.tip.clientWidth + 1) rt.tip.classList.add("wrap");
    const box = anchor.getBoundingClientRect();
    const tipBox = rt.tip.getBoundingClientRect();
    const root = document.documentElement;
    const above = box.top - tipBox.height - 8;
    const below = box.bottom + 8;
    const up = above >= 8 || (below + tipBox.height > root.clientHeight - 8 && box.top > root.clientHeight - box.bottom);
    rt.tip.classList.add(up ? "up" : "down");
    rt.tip.style.top = `${Math.round(Math.max(8, Math.min(up ? above : below, root.clientHeight - tipBox.height - 8)))}px`;
    rt.tip.style.left = `${Math.round(Math.min(Math.max(8, box.left + box.width / 2 - tipBox.width / 2), root.clientWidth - tipBox.width - 8))}px`;
  }

  function hideTip(now?: boolean): void {
    clearTimeout(rt.tipTimer);
    if (!now) {
      if (!rt.tipPinned) rt.tipTimer = setTimeout(() => hideTip(true), rt.tipMenu ? 300 : 150);
      return;
    }
    const back = rt.tip.contains(document.activeElement) && rt.tipFor && document.contains(rt.tipFor) ? rt.tipFor : null;
    if (rt.tipFor) {
      if (rt.tipMenu) rt.tipFor.setAttribute("aria-expanded", "false");
      rt.tipFor.classList.remove("open");
    }
    rt.tip.hidden = true;
    rt.tipFor = null;
    rt.tipMenu = false;
    rt.tipPinned = false;
    if (back) {
      rt.quietFocus = true;
      back.focus();
      rt.quietFocus = false;
    }
  }

  function showList(chip: HTMLElement, pin?: boolean): void {
    clearTimeout(rt.tipTimer);
    if (rt.tipFor !== chip || rt.tip.hidden) {
      if (rt.tipFlash) {
        clearTimeout(rt.tipFlash.t);
        rt.tipFlash = null;
      }
      tipMode("list");
      rt.tipFor = chip;
      rt.tip.innerHTML = (chip.getAttribute("data-games") ?? "")
        .split(" ")
        .filter(Boolean)
        .map((id) => `<span class="li">${esc(rt.model.gamesById[id]?.name ?? id)}</span>`)
        .join("");
      chip.classList.add("open");
      placeTip(chip);
    }
    if (pin) rt.tipPinned = true;
  }

  function showTip(anchor: HTMLElement, force?: boolean): void {
    clearTimeout(rt.tipTimer);
    if (rt.tipFor === anchor && !rt.tip.hidden && !force) return;
    if (rt.tipFlash && rt.tipFlash.a !== anchor) {
      clearTimeout(rt.tipFlash.t);
      rt.tipFlash = null;
    }
    tipMode("label");
    rt.tipFor = anchor;
    let social: [string, string][] | null = null;
    try {
      social = anchor.hasAttribute("data-soc") ? (JSON.parse(anchor.getAttribute("data-soc") ?? "") as [string, string][]) : null;
    } catch {
      social = null;
    }
    if (social) rt.tip.innerHTML = social.map((parts) => socialLineHtml(parts)).join("");
    else rt.tip.textContent = anchor.getAttribute("data-tip");
    placeTip(anchor);
  }

  function showMenu(button: HTMLElement, pin: boolean, focus?: string): void {
    clearTimeout(rt.tipTimer);
    if (rt.tipFor !== button || !rt.tipMenu || rt.tip.hidden) {
      if (rt.tipFlash) {
        clearTimeout(rt.tipFlash.t);
        rt.tipFlash = null;
      }
      tipMode("menu", button.getAttribute("aria-label") ?? "");
      rt.tipFor = button;
      const row = button.closest(".item");
      const hit = row ? rt.list[Number(row.getAttribute("data-k"))] : undefined;
      rt.tip.innerHTML = hit ? valueMenuHtml(hit.main.ch, button.getAttribute("data-ch") ?? "", rt.coarse) : "";
      button.setAttribute("aria-expanded", "true");
      placeTip(button);
    }
    if (pin) rt.tipPinned = true;
    if (!focus) return;
    const items = rt.tip.querySelectorAll<HTMLElement>(".mi");
    const item = items[focus === "last" ? items.length - 1 : 0];
    item?.focus();
  }

  function flashTip(anchor: HTMLElement, text: string, ok: boolean): void {
    if (rt.tipFlash) clearTimeout(rt.tipFlash.t);
    clearTimeout(rt.tipTimer);
    tipMode("label");
    rt.tipFor = anchor;
    rt.tip.textContent = "";
    rt.tip.classList.toggle("ok", !!ok);
    if (ok) rt.tip.insertAdjacentHTML("beforeend", ico("check", null, 14));
    rt.tip.appendChild(document.createTextNode(text));
    placeTip(anchor);
    rt.tipFlash = {
      a: anchor,
      t: setTimeout(() => {
        rt.tipFlash = null;
        if (rt.tipFor !== anchor) return;
        if (anchor.matches(":hover") || anchor === document.activeElement) showTip(anchor, true);
        else hideTip(true);
      }, 1600),
    };
  }

  function flashItem(item: HTMLElement, ok: boolean): void {
    const existing = copied.get(item);
    const state = existing ?? { html: item.innerHTML, timer: undefined as ReturnType<typeof setTimeout> | undefined };
    if (!existing) {
      item.style.minWidth = `${item.offsetWidth}px`;
      copied.set(item, state);
    }
    clearTimeout(state.timer);
    item.classList.toggle("ok", ok);
    item.innerHTML = `${ok ? ico("check", null, 14) : ""}<span class="tname">${ok ? "Copied" : "Couldn't copy"}</span>`;
    state.timer = setTimeout(() => {
      item.innerHTML = state.html;
      copied.delete(item);
      item.style.minWidth = "";
      item.classList.remove("ok");
    }, 1600);
  }

  function dropStaleTip(): void {
    if (!rt.tip.hidden && rt.tipFor && !document.contains(rt.tipFor)) hideTip(true);
  }

  function hintAt(event: Event): HTMLElement | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const anchor = target.closest<HTMLElement>("[data-tip]");
    return anchor && !rt.out.contains(anchor) ? anchor : null;
  }

  rt.hideTip = hideTip;
  rt.showTip = showTip;
  rt.showMenu = showMenu;
  rt.showList = showList;
  rt.dropStaleTip = dropStaleTip;
  rt.copyText = copyText;
  rt.flashTip = flashTip;

  rt.out.addEventListener("pointerover", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest<HTMLElement>(".lk:not(.off), .chip.more") : null;
    if (!anchor || event.pointerType !== "mouse" || (rt.tipFlash && rt.tipFlash.a === anchor)) return;
    if (anchor.classList.contains("more")) showList(anchor);
    else if (anchor.tagName === "BUTTON") showMenu(anchor, false);
    else showTip(anchor);
  });
  rt.out.addEventListener("pointerout", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest<HTMLElement>(".lk:not(.off), .chip.more") : null;
    if (anchor && anchor === rt.tipFor && !anchor.contains(event.relatedTarget as Node) && !(rt.tipFlash && rt.tipFlash.a === anchor))
      hideTip();
  });
  rt.tip.addEventListener("pointerenter", () => clearTimeout(rt.tipTimer));
  rt.tip.addEventListener("pointerleave", () => hideTip());
  rt.out.addEventListener("focusin", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest<HTMLElement>(".lk:not(.off)") : null;
    if (!anchor || rt.quietFocus) return;
    let keyboard = true;
    try {
      keyboard = anchor.matches(":focus-visible");
    } catch {
      keyboard = true;
    }
    if (!keyboard) return;
    if (anchor.tagName === "BUTTON") showMenu(anchor, false);
    else showTip(anchor);
  });
  rt.out.addEventListener("focusout", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest(".lk") : null;
    if (anchor && !rt.tip.contains(event.relatedTarget as Node)) hideTip(true);
  });
  rt.out.addEventListener("keydown", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>("button.lk") : null;
    if (button && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      showMenu(button, true, event.key === "ArrowUp" ? "last" : "first");
    }
  });
  rt.tip.addEventListener("keydown", (event) => {
    if (!rt.tipMenu) return;
    const items = [...rt.tip.querySelectorAll<HTMLElement>(".mi")];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const count = items.length;
    if (!count) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const down = event.key === "ArrowDown";
      const next = index < 0 ? (down ? 0 : count - 1) : (index + (down ? 1 : count - 1)) % count;
      items[next]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : count - 1]?.focus();
    } else if (event.key === " ") {
      event.preventDefault();
      if (index > -1) items[index]?.click();
    } else if (event.key === "Tab") hideTip(true);
  });
  rt.tip.addEventListener("focusout", (event) => {
    if (rt.tipMenu && !rt.tip.contains(event.relatedTarget as Node) && event.relatedTarget !== rt.tipFor) hideTip(true);
  });
  rt.tip.addEventListener("mousedown", (event) => {
    const target = event.target;
    if (target instanceof Element && !target.closest(".mi")) event.preventDefault();
  });
  rt.tip.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest(".mi");
    if (!(item instanceof HTMLElement)) return;
    const value = item.getAttribute("data-val");
    if (value && !rt.coarse) {
      event.preventDefault();
      void copyText(value).then((ok) => {
        flashItem(item, ok);
        clearTimeout(rt.announce);
        rt.live.textContent = `${ok ? "Copied " : "Couldn't copy "}${value}`;
      });
      return;
    }
    setTimeout(() => hideTip(true), 0);
  });
  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if ((rt.tipMenu || rt.tipPinned) && !rt.tip.hidden && !rt.tip.contains(target) && !(rt.tipFor && rt.tipFor.contains(target)))
      hideTip(true);
  });
  document.addEventListener(
    "pointermove",
    (event) => {
      if (rt.hintsReady) return;
      rt.hintsReady = true;
      const anchor = hintAt(event);
      if (anchor && event.pointerType === "mouse" && anchor !== rt.tipSnooze && (rt.tip.hidden || rt.tipFor !== anchor)) showTip(anchor);
    },
    { passive: true },
  );
  document.addEventListener("pointerover", (event) => {
    dropStaleTip();
    const anchor = hintAt(event);
    if (anchor && event.pointerType === "mouse" && anchor !== rt.tipSnooze && rt.hintsReady) showTip(anchor);
  });
  document.addEventListener("pointerout", (event) => {
    const anchor = hintAt(event);
    if (!anchor || (event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget))) return;
    if (anchor === rt.tipSnooze) rt.tipSnooze = null;
    if (anchor === rt.tipFor) hideTip();
  });
  document.addEventListener("pointerdown", (event) => {
    const anchor = hintAt(event);
    if (!anchor) return;
    rt.tipSnooze = anchor;
    if (anchor === rt.tipFor && !rt.tipMenu) hideTip(true);
  });
  document.addEventListener("focusin", (event) => {
    const anchor = hintAt(event);
    if (!anchor || rt.quietFocus) return;
    let keyboard = true;
    try {
      keyboard = anchor.matches(":focus-visible");
    } catch {
      keyboard = true;
    }
    if (keyboard) showTip(anchor);
  });
  document.addEventListener("focusout", (event) => {
    const anchor = hintAt(event);
    if (anchor && anchor === rt.tipFor) hideTip(true);
  });
  rt.overlay.addEventListener("scroll", () => {
    if (!rt.tip.hidden) hideTip(true);
  }, true);
  window.addEventListener("scroll", () => {
    if (!rt.tip.hidden) hideTip(true);
  }, { passive: true });
  window.addEventListener("blur", () => hideTip(true));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !rt.tip.hidden) hideTip(true);
  }, true);
}
