import { addrOneLine, mapsHref, socialLabel, socialParts, telHref, type Channels } from "./channels";
import { CH, type ChannelKey } from "./constants";
import { brandIcon, ico } from "./icons";
import type { Location } from "./model";
import { esc, host, toHttps } from "./text";

const MULTI: Record<string, string> = {
  phone: " phone numbers",
  email: " email addresses",
  web: " websites",
  social: " social links",
};

export function socialInner(parts: [string, string]): string {
  const mark = brandIcon(parts[0]) || (parts[0] && parts[1] ? `<span class="tplat">${esc(parts[0])}</span>` : "");
  return `${mark}<span class="tname">${esc(parts[1] || parts[0])}</span>`;
}

export function socialLineHtml(parts: [string, string]): string {
  return `<span class="tline">${socialInner(parts)}</span>`;
}

interface IconSpec {
  href: string;
  tip: string;
  val?: string;
  soc?: [string, string][];
}

/** One icon per channel. Several values open a menu; one value is the link itself. */
export function linkIcons(location: Location, coarse: boolean): string {
  const set = location.ch;
  const spec: Partial<Record<ChannelKey, IconSpec | false>> = {
    maps: set.maps && { href: mapsHref(location), tip: addrOneLine(location) },
    phone: set.phone.length ? { href: telHref(set.phone[0] ?? ""), tip: set.phone[0] ?? "", val: set.phone[0] } : false,
    email: set.email.length ? { href: `mailto:${set.email[0] ?? ""}`, tip: set.email[0] ?? "", val: set.email[0] } : false,
    web: set.web.length ? { href: toHttps(set.web[0] ?? ""), tip: host(toHttps(set.web[0] ?? "")) } : false,
    social: set.social.length
      ? { href: set.social[0] ?? "", tip: socialLabel(set.social[0] ?? ""), soc: [socialParts(set.social[0] ?? "")] }
      : false,
  };
  const icons = CH.map((channel) => {
    const item = spec[channel.k];
    const count = channel.k === "maps" ? 1 : (set[channel.k] as string[]).length;
    if (!item) return `<span class="lk off" aria-hidden="true">${ico(channel.i, null, 16)}</span>`;
    if (count > 1) {
      return `<button type="button" class="lk" data-ch="${channel.k}" aria-haspopup="menu" aria-expanded="false" aria-label="${count}${MULTI[channel.k] ?? ""}">${ico(channel.i, channel.c, 16)}</button>`;
    }
    const external = !/^(tel|mailto):/.test(item.href);
    const copies = item.val && !coarse;
    const soc = item.soc ? ` data-soc='${esc(JSON.stringify(item.soc))}'` : "";
    const val = item.val ? ` data-val="${esc(item.val)}"` : "";
    const label = copies ? `Copy ${channel.label.toLowerCase()} ${item.val}` : `${channel.label}: ${item.tip}`;
    return `<a class="lk" href="${esc(item.href)}"${external ? ' target="_blank" rel="noopener"' : ""} data-tip="${esc(item.tip)}"${val}${soc} aria-label="${esc(label)}">${ico(channel.i, channel.c, 16)}</a>`;
  }).join("");
  return `<span class="links">${icons}</span>`;
}

export function valueMenuHtml(set: Channels, key: string, coarse: boolean): string {
  const values = set[key as ChannelKey];
  if (!Array.isArray(values)) return "";
  const hosts = key === "web" ? values.map((value) => host(toHttps(value))) : [];
  return values
    .map((value, index) => {
      if (key === "phone" || key === "email") {
        const href = key === "phone" ? telHref(value) : `mailto:${value}`;
        const label = coarse ? "" : ` aria-label="Copy ${esc(value)}"`;
        return `<a class="mi" role="menuitem" tabindex="-1" href="${esc(href)}" data-val="${esc(value)}"${label}><span class="tname">${esc(value)}</span></a>`;
      }
      const url = key === "web" ? toHttps(value) : value;
      let label = hosts[index] ?? "";
      if (key === "web" && hosts.indexOf(label) !== hosts.lastIndexOf(label)) {
        try {
          label += new URL(url).pathname.replace(/\/+$/, "");
        } catch {
          /* keep the host */
        }
      }
      if (key === "social") {
        return `<a class="mi" role="menuitem" tabindex="-1" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${esc(socialLabel(value))}">${socialInner(socialParts(value))}</a>`;
      }
      return `<a class="mi" role="menuitem" tabindex="-1" href="${esc(url)}" target="_blank" rel="noopener"><span class="tname">${esc(label)}</span></a>`;
    })
    .join("");
}
