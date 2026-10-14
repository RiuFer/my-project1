import type { Hit } from "./filter";
import type { Model } from "./model";

export interface Runtime {
  model: Model;
  q: HTMLInputElement;
  out: HTMLElement;
  overlay: HTMLElement;
  live: HTMLElement;
  sbox: HTMLElement;
  sbtn: HTMLButtonElement;
  head: HTMLElement;
  updated: HTMLElement;
  openKey: string;
  pushedStore: boolean;
  lastFocus: HTMLElement | null;
  focusFromClick: boolean;
  shown: number;
  list: Hit[];
  games: Record<string, true>;
  city: Record<string, true>;
  active: Record<string, boolean>;
  known: boolean;
  openCol: string | null;
  anchor: HTMLElement | null;
  openProv: Record<string, boolean | undefined>;
  cpop: HTMLDivElement;
  tip: HTMLDivElement;
  tipFor: HTMLElement | null;
  tipTimer: ReturnType<typeof setTimeout> | undefined;
  tipFlash: { a: HTMLElement; t: ReturnType<typeof setTimeout> } | null;
  tipMenu: boolean;
  tipPinned: boolean;
  quietFocus: boolean;
  tipSnooze: HTMLElement | null;
  hintsReady: boolean;
  announce: ReturnType<typeof setTimeout> | undefined;
  searchOpen: boolean;
  coarse: boolean;
  wide: MediaQueryList;
  render: () => void;
  hideTip: (now?: boolean) => void;
  showTip: (anchor: HTMLElement, force?: boolean) => void;
  showMenu: (button: HTMLElement, pin: boolean, focus?: string) => void;
  showList: (chip: HTMLElement, pin?: boolean) => void;
  dropStaleTip: () => void;
  closePop: (refocus: boolean) => void;
  fillPop: () => void;
  placePop: () => void;
  syncHead: () => void;
  drawHead: () => void;
  requestClose: () => void;
  hideStore: () => void;
  setSearch: (open: boolean, focus: boolean) => void;
  termsNow: () => string[];
  copyText: (text: string) => Promise<boolean>;
  flashTip: (anchor: HTMLElement, text: string, ok: boolean) => void;
  route: () => void;
}

function must<T extends HTMLElement>(id: string, kind: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof kind)) throw new Error(`Missing #${id}`);
  return el;
}

export function createRuntime(model: Model): Runtime {
  const wide = window.matchMedia("(min-width: 560px)");
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const cpop = document.createElement("div");
  cpop.className = "cpop";
  cpop.hidden = true;
  cpop.setAttribute("role", "dialog");
  document.body.appendChild(cpop);
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.appendChild(tip);
  const noop = () => {};
  return {
    model,
    q: must("q", HTMLInputElement),
    out: must("out", HTMLElement),
    overlay: must("overlay", HTMLElement),
    live: must("live", HTMLElement),
    sbox: must("search", HTMLElement),
    sbtn: must("sbtn", HTMLButtonElement),
    head: must("head", HTMLElement),
    updated: must("updated", HTMLElement),
    openKey: "",
    pushedStore: false,
    lastFocus: null,
    focusFromClick: false,
    shown: 0,
    list: [],
    games: {},
    city: {},
    active: {},
    known: false,
    openCol: null,
    anchor: null,
    openProv: {},
    cpop,
    tip,
    tipFor: null,
    tipTimer: undefined,
    tipFlash: null,
    tipMenu: false,
    tipPinned: false,
    quietFocus: false,
    tipSnooze: null,
    hintsReady: true,
    announce: undefined,
    searchOpen: false,
    coarse,
    wide,
    render: noop,
    hideTip: noop,
    showTip: noop,
    showMenu: noop,
    showList: noop,
    dropStaleTip: noop,
    closePop: noop,
    fillPop: noop,
    placePop: noop,
    syncHead: noop,
    drawHead: noop,
    requestClose: noop,
    hideStore: noop,
    setSearch: noop,
    termsNow: () => [],
    copyText: () => Promise.resolve(false),
    flashTip: noop,
    route: noop,
  };
}
