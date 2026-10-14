# TCG Shop

Canadian shops that sell or host events for trading card games. The page is a static Astro site: search, header filters, and the shop window all run in the browser from one public catalog.

## Scripts

```bash
bun install
bun run dev       # Astro dev server
bun test          # catalog shape, search, and filters
bun run build     # astro check and static build into dist/
bun run preview   # Wrangler dev, serving dist/
```

`bun run deploy` builds and runs `wrangler deploy`. Leave it unused until you mean to publish.

Hash links such as `/#shop-id` stay on `/`. Unknown paths are the 404 page.
