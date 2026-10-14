import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { defineConfig } from "astro/config";

function sha256(text: string): string {
  return `'sha256-${createHash("sha256").update(text).digest("base64")}'`;
}

/** Allows the inlined stylesheet under style-src without unsafe-inline. The hash is the exact style text. */
function cspHashes(): AstroIntegration {
  return {
    name: "csp-hashes",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const root = fileURLToPath(dir);
        const styleHashes = new Set<string>();
        const files = await htmlFiles(root);
        for (const file of files) {
          const html = await lowPriorityApp(await readFile(file, "utf8"), root);
          await writeFile(file, html);
          for (const match of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
            const css = match[1];
            if (css) styleHashes.add(sha256(css));
          }
        }
        const headersPath = path.join(root, "_headers");
        const headers = await readFile(headersPath, "utf8");
        const styles = ["'self'", ...styleHashes].join(" ");
        const next = headers.replace("style-src 'self'", `style-src ${styles}`);
        if (next === headers) throw new Error("style-src 'self' was not found in dist/_headers");
        await writeFile(headersPath, next);
      },
    },
  };
}

/**
 * Chrome treats High, Medium, and render-blocking requests as the critical chain.
 * The page module is deferred and low priority, so it is not part of that chain.
 * The app file is modulepreloaded, which DevTools does not count as critical.
 */
async function lowPriorityApp(html: string, root: string): Promise<string> {
  const match = html.match(/<script type="module" src="([^"]+)"><\/script>/);
  const src = match?.[1];
  if (!match || !src) return html;
  const low = `<script type="module" src="${src}" fetchpriority="low"></script>`;
  let tags = low;
  const base = process.env.BASE_PATH?.replace(/\/$/, "") ?? "";
  const urlPath = base && src.startsWith(`${base}/`) ? src.slice(base.length) : src;
  const js = await readFile(path.join(root, urlPath.replace(/^\//, "")), "utf8");
  const app = js.match(/import\([`'"]\.\/(app\.[^`'"]+\.js)[`'"]\)/);
  const file = app?.[1];
  if (file) {
    const dir = src.slice(0, src.lastIndexOf("/") + 1);
    tags = `<link rel="modulepreload" href="${dir}${file}" crossorigin>${tags}`;
  }
  return html.replace(match[0], tags);
}

async function htmlFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

const pagesBase = process.env.BASE_PATH;

export default defineConfig({
  site: process.env.SITE,
  base: pagesBase,
  integrations: [cspHashes()],
  output: "static",
  build: {
    inlineStylesheets: "always",
  },
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
});
