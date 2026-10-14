# Getting the Lighthouse 100s with a program

The perfect-score session was a loop: build the static site, serve `dist`, run Lighthouse, read the JSON, change the page, and repeat. The model picked the edits. The measurement, the pass rule, and almost every edit are things a script can do. The script needs a small table of approved fixes, keyed by audit id. It does not need to invent a new page.

This report covers that session, and the later check that a second Lighthouse paste (7,111 KiB, 22 KiB of document savings, 1,506 KiB of “minify JavaScript”) was the Astro dev server.

## What the session measured

The page under test was the production preview, `http://127.0.0.1:8787/`, after `astro build`. Lighthouse was run for mobile and desktop. The homepage and the 404 page were both checked. The categories were performance, accessibility, best practices, SEO, and agentic browsing.

The run ended here:

| Category | Mobile | Desktop |
|---|---|---|
| Performance | 100 | 100 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |
| Agentic browsing | 100 | 100 |

The homepage console was clean. The 404 document itself still logs a 404, because that response is a 404.

Along the way the scores moved through three real failures, then one regression:

1. Accessibility was 98, agentic browsing was 52 because of layout shift, and a missing favicon produced a console error.
2. After those were fixed, performance was 95 because the catalog script ran on the main thread before first paint.
3. Raising performance brought back an accessibility failure: touch targets (`target-size`) scored 0, and accessibility dropped to 96. Shop name buttons were under 24px, and `content-visibility: auto` on rows made Lighthouse measure targets it could not size.
4. After a 24px minimum on those buttons and removing `content-visibility`, every category was 100 again.

A category score of 100 still left some insight rows below 1. On the final mobile performance report, First Contentful Paint and Total Blocking Time were 0.99, Max Potential FID was 0.91, and the network-dependency-tree and render-blocking insights were 0. Those rows did not pull the weighted category below 100, so the session stopped. A program has to use that same definition of done. A gate that demands every audit `score === 1` will keep failing on the CSS file (render-blocking) and the font chain (HTML, then CSS, then Public Sans) after the badge is already 100.

## The program

One command, run in CI or locally against the built site:

```bash
bun run build
# serve dist the way production does (wrangler, or any static server with the _headers file)
lighthouse "$PREVIEW/" \
  --only-categories=performance,accessibility,best-practices,seo,agentic-browsing \
  --form-factor=mobile --screenEmulation.mobile \
  --output=json --output-path=lh-mobile.json
lighthouse "$PREVIEW/" \
  --only-categories=performance,accessibility,best-practices,seo,agentic-browsing \
  --preset=desktop \
  --output=json --output-path=lh-desktop.json
lighthouse "$PREVIEW/missing-path" \
  --only-categories=accessibility,best-practices,seo,agentic-browsing \
  --preset=desktop \
  --output=json --output-path=lh-404.json
```

Pin the Lighthouse version and the Chrome binary. Start Chrome once with `--remote-debugging-port` and pass `--port` so each run reuses it. Collect browser console errors with the same Chrome (DevTools protocol `Runtime.consoleAPICalled` and `Log.entryAdded`, or Lighthouse’s `errors-in-console` audit). Then apply the gate below. Chrome DevTools MCP, reading Lighthouse’s scoring source, and hand-computing the log-normal curve were how the session inspected a 95. The category score is already the field `categories.<id>.score`.

`bun test` stays beside this. Lighthouse does not check search, filters, or the catalog shape.

### Pass rule

Fail the command unless all of these hold:

- Every requested category has `score === 1` (Lighthouse stores 1, not 100).
- `runtimeError` is null and `runWarnings` is empty.
- The homepage console has no error entries.
- A 404 URL may log the failed document request. Any other console error fails the run.
- The audited URL is the built site. The dev-server check below runs first.

Print each failing audit’s `id`, `title`, `score`, and `details.items` (node snippet, URL, wasted bytes, or task duration). That list is the input to the recipe table. Stop after a fixed number of rounds (the session needed a handful) and print the remaining items. Do not keep editing once every category is 1.

### Audit the built site only

The follow-up paste was a Lighthouse run against `astro dev` on port 4321. A script can reject that run before anyone reads the insights.

Reject the report when any of these are true:

- The document contains `data-vite-dev-id`, or a script URL is `/@vite/client` or starts with `/src/`.
- A script URL contains `catalog.json?import`. On that dev server that module was 5,094,884 bytes, and 4,235,826 of them were an inline `sourceMappingURL`. The raw catalog is 858,860 bytes. The extra weight is the source map, base64 mappings included.
- “Document request latency” savings are about two thirds of the document size. Dev HTML was 33,702 bytes because Vite inlined `global.css` into the document and did not compress it. `33702 * 0.67 = 22,580` bytes, which Lighthouse prints as 22 KiB.

The 7,111 KiB total is the sum of that catalog module (4,975 KiB), the other dev modules including the Astro toolbar (about 2,027 KiB), the 33 KiB document, and the six Public Sans files (about 74 KiB). “Minify JavaScript, 1,506 KiB” is whitespace and source-map comments in those dev modules (`@vite/client`, `aria-query`, `axobject-query`, and the toolbar). “Minify CSS, 8 KiB” is unminified `global.css`. Duplicated JavaScript (9 KiB), unused JavaScript (28 KiB), and the five long tasks are the same dev graph: helpers loaded twice, toolbar code never called during the trace, and large modules parsed on the main thread.

The built preview does not produce those rows. Wrangler gzip-compresses when the browser sends `Accept-Encoding`. The catalog worker in `dist` is 822,575 bytes raw and about 152,000 bytes on the wire, and the Lighthouse performance category on that preview was 100.

The check is: if the document looks like Vite dev, print “audit `bun run build` and the preview” and exit. There is nothing to minify in application source for those savings.

## Recipe table

Each recipe is a detection in `report.json` and a patch the script may apply. After each patch, rebuild and remeasure. If a category that was 1 drops below 1, revert that patch and stop with both reports. That rule matters: `content-visibility: auto` was added for rendering cost and then removed because it made `target-size` fail.

| Audit | How to see it | Patch the script may apply |
|---|---|---|
| `errors-in-console` mentioning a favicon | A request for `/favicon.ico` returns 404, and the document has no `link[rel=icon]` | Add `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` in `src/layouts/Base.astro`. The file `public/favicon.svg` has to exist already. The script should not draw an icon. |
| Layout shift / agentic browsing | `cumulative-layout-shift` under 1, or shift clusters whose node is the footer, the title count, or the “Last updated” line | Put the shop count and the updated date in the HTML at build time (`buildModel` on `catalog.json` in `src/pages/index.astro`). On the client, write those strings only when they differ. Give `.list` `min-height: 100dvh` so the footer stays below the fold until rows exist. |
| Web font shifting text | A layout-shift or font-display insight names Public Sans | Set `font-display: optional` on the existing `@font-face` rules. This is an approved product choice: a late font does not move the page, and it may not appear on that load. |
| `target-size` | Each item has a node snippet. Shop name buttons (`.nmbtn`) were under 24×24 CSS pixels | Set `min-width: 24px` and `min-height: 24px` on the failing selector. If the selector’s rule also has `content-visibility` or `contain-intrinsic-size`, delete those two declarations. |
| Performance category under 1, bootup or a long task on the catalog script before first paint | `bootup-time` or `long-tasks` items whose URL is the page script, and that script’s source contains `import catalog from "../data/catalog.json"` | Move that import into `src/scripts/catalog.worker.ts` and `postMessage` the built model. In the page script, construct the worker, wait two animation frames, then `import()` the app and pass the model in. Keep `buildModel` as the only catalog parse. This matches the current `src/pages/index.astro` script. It is a fixed codemod for this one page, not a general bundler. |
| 404 has no main landmark | The 404 document’s accessibility audit for a main landmark is under 1 | Wrap the existing 404 content in `<main>`. Do not add a second main on the homepage, which already has one. |

Two edits in the same CSS pass were layout, not a separate audit id: the search field on viewports at least 561px wide got an explicit width (`clamp(240px, 22vw, 380px)`), and one `font-weight: 500` became `600`. A script should only change font weight when a `color-contrast` item names that node, and only set the search width when a shift cluster names `#q`. Neither should be applied just because the category is low.

Header policy in `dist/_headers` (CSP, `nosniff`, referrer policy, immutable `/_astro/*`) is already static. The script checks that the preview responses include those headers. It does not regenerate them.

## What the script should refuse to “fix”

These were still under 1 when the category was 100. Chasing them is a different project:

- **Render-blocking CSS.** The stylesheet is external because CSP is `style-src 'self'` with no inline style. Inlining it means adding a hash to the CSP. That is a config change with a security tradeoff, not a Lighthouse cleanup.
- **Network dependency tree.** The longest chain is the document, then `Base.*.css`, then a Public Sans file. Preload would add a hint; it would not remove the font from the chain. `font-display: optional` already keeps that font off the LCP element, which is the `h1`.
- **Dev-server minify and payload insights.** Described above. The built files are already minified.

## What still is not a script

The recipes above are closed. Someone had to decide that a worker, a `100dvh` placeholder, optional font display, and a 24px hit target were acceptable for this directory. The program’s job is to notice which audit failed, apply the matching approved patch, and prove the categories are 1 again. Generating a new layout from a score is the part that needed a model, and it is the part the recipe table replaces.
