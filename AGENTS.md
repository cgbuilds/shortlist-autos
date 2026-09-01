# Agent handoff — Shortlist Autos

## Where this came from

`github.com/cgbuilds/shortlist-autos` only had `# shortlist-autos` on `main`. There was **no handoff file in the clone**.

The working product is already on Vercel:

- https://shortlist.autos
- https://shortlist-autos.vercel.app

Sister app (homes, same visual language): https://shortlist.casa

This branch is a **source reconstruction** of that autos demo (routes, sample inventory, scoring filters, chat matrix, share tokens, map). Other agent transcripts were not accessible from this cloud environment.

## Product

Chat-first used-car shortlist. Default layout is **Gallery** (4:3 desktop thumbnail + compact mobile strip, source links, photo lightbox). **Split view** is the map + ranked list. Toggle is saved in `localStorage` (`shortlist-autos-layout-v1`).

**Inventory:** `/api/search` goes through `src/lib/inventory.ts`. With `MARKETCHECK_API_KEY` it pulls live used cars near the user (or Tampa). Without a key, or if the live call fails, it uses the 16-car Tampa sample in `src/data/vehicles.ts`. This is not a Cars.com scrape.

**Check the live key** (does not print the secret; shows length + last 4 chars):

```bash
cp .env.example .env.local   # then paste MARKETCHECK_API_KEY=… (API Key, not client secret)
npm run check:marketcheck
```

Or, after demo cookie: `GET /api/marketcheck`. `ok=true` means MarketCheck accepted the key. HTTP 401/403 means the wrong credential. Cursor environment secrets are not the same as Vercel env vars — set `MARKETCHECK_API_KEY` on both if you want live inventory in agents and production.

**Chat:** `/api/chat` uses **OpenRouter** when `OPENROUTER_API_KEY` is set. Model comes from `OPENROUTER_MODEL` (default `openrouter/auto`). Confirm / “yes” still skip the model. If the key is missing or OpenRouter fails, the deterministic parser in `src/lib/chat.ts` is the fallback. LLM output is sanitized onto `MustHaveMatrix` before search.

**Flow:** `/app` shows nearby cars first (geolocation, else Tampa). Chat bounces until must-haves are set. Chat reads preferences back; **Confirm & search** (or “yes”) then searches and grades. Copy link shares a deflate-raw token in `/s#s1.…`.

Car photos live in `public/cars/{listing-id}.jpg` for sample rows (Wikimedia Commons). Live rows use the listing photo when the feed includes one.

Default **browse** matrix is location-only (Tampa, FL). Must-haves are empty until confirmed.

Demo identity shown in the header: `family@demo.local`. Cookie: `sa_demo=1` (httpOnly, 30 days).

## Live routes to match

| Path | Role |
| --- | --- |
| `GET /` | Landing + demo button |
| `GET /app` | Map + ranked cards + chat (auth/demo required) |
| `GET /s` | Decode hash share → write session → `/app?shared=1` |
| `POST /api/demo` | Sets demo cookie, `{ok:true}` |
| `POST /api/logout` | Clears cookie |
| `POST /api/search` | `{matrix, mode: "browse"|"grade", lat?, lng?, listings?}` → `{results, listings, totalMatched, source, origin}` |
| `GET /api/marketcheck` | Demo cookie required. Probes MarketCheck with the server key; returns `{ok, httpStatus, numFound, keySuffix, …}` (never the full key) |
| `POST /api/chat` | `{text, draft, confirm?, history?}` → `{reply, matrix, rescore, awaitingConfirm, source}` |

Chat without `text` → `400 {"error":"Missing text"}`. Search/chat without demo cookie → `401`.

## Inventory

`loadInventory` tries MarketCheck when `MARKETCHECK_API_KEY` is present (`GET https://api.marketcheck.com/v2/search/car/active`). Otherwise 16 sample vehicles in `src/data/vehicles.ts` (IDs like `rav4-21-tampa`, `cx5-20-lutz`). Search `source` is `"live"`, `"sample"`, or `"session"` (shared lists).

Outbound listing links: Cars.com (zip+keyword), Autotrader (zip+make), Google search. Live rows prefer `listingUrl` from the feed.

## Stack

Next.js App Router, Tailwind, Fraunces + Source Sans 3, Leaflet (`tile.openstreetmap.de`, Esri fallback), localStorage key `shortlist-autos-session-v1`.

Share payload: `{v:1, matrix, listings: first 10}` compressed with `CompressionStream("deflate-raw")`, base64url, prefixed `s1.`.

Map: circle markers by grade band, 20-mile radius if geolocation succeeds and the user does not have an imported list.

## What is still not in this repo (live-only / next work)

- Supabase Google / magic-link (casa landing mentions keys; autos Vercel currently shows **demo only**)
- Live inventory requires a MarketCheck key on Vercel (`MARKETCHECK_API_KEY`); without it the Tampa sample is the production fallback
- Quota system (casa `/api/search` returns quota; autos sample search does not)
- Custom domain / Vercel project wiring for this GitHub repo (the live project is already deployed from another source)

## Suggested next slice

1. Point the existing Vercel project at this GitHub repo (or import it) so source and production match.
2. Port casa’s Supabase family accounts if those keys belong on autos too.
3. Add `MARKETCHECK_API_KEY` on Vercel **and** as a Cursor environment secret (API Key only). Verify with `npm run check:marketcheck`.
4. `OPENROUTER_API_KEY` + `OPENROUTER_MODEL=openrouter/auto` are already wired.
