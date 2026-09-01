# Agent handoff — Shortlist Autos

## Where this came from

`github.com/cgbuilds/shortlist-autos` only had `# shortlist-autos` on `main`. There was **no handoff file in the clone**.

The working product is already on Vercel:

- https://shortlist.autos
- https://shortlist-autos.vercel.app

Sister app (homes, same visual language): https://shortlist.casa

This branch is a **source reconstruction** of that autos demo (routes, sample inventory, scoring filters, chat matrix, share tokens, map). Other agent transcripts were not accessible from this cloud environment.

## Product

Chat-first used-car shortlist. User sets must-haves in chat. Sample **Tampa-area** listings are filtered/scored and shown on one map. Copy link shares a deflate-raw token in `/s#s1.…`.

Default matrix (from the live `/app` bundle):

```
Tampa, FL · suv · $35,000 · 80,000 mi · 2018+ · 5 seats
```

Demo identity shown in the header: `family@demo.local`. Cookie: `sa_demo=1` (httpOnly, 30 days).

## Live routes to match

| Path | Role |
| --- | --- |
| `GET /` | Landing + demo button |
| `GET /app` | Map + ranked cards + chat (auth/demo required) |
| `GET /s` | Decode hash share → write session → `/app?shared=1` |
| `POST /api/demo` | Sets demo cookie, `{ok:true}` |
| `POST /api/logout` | Clears cookie |
| `POST /api/search` | `{matrix, listings?}` → `{results, listings, totalMatched, source}` |
| `POST /api/chat` | `{text, draft}` → `{reply, matrix, rescore}` |

Chat without `text` → `400 {"error":"Missing text"}`. Search/chat without demo cookie → `401`.

## Inventory

16 sample vehicles are in `src/data/vehicles.ts` (IDs like `rav4-21-tampa`, `cx5-20-lutz`). Live `/api/search` `source` is `"sample"`.

Outbound listing links: Cars.com (zip+keyword), Autotrader (zip+make), Google search.

## Stack

Next.js App Router, Tailwind, Fraunces + Source Sans 3, Leaflet (`tile.openstreetmap.de`, Esri fallback), localStorage key `shortlist-autos-session-v1`.

Share payload: `{v:1, matrix, listings: first 10}` compressed with `CompressionStream("deflate-raw")`, base64url, prefixed `s1.`.

Map: circle markers by grade band, 20-mile radius if geolocation succeeds and the user does not have an imported list.

## What is still not in this repo (live-only / next work)

- Supabase Google / magic-link (casa landing mentions keys; autos Vercel currently shows **demo only**)
- Live inventory search beyond the 16-car sample
- LLM-backed chat (production chat likely has a server key; this reconstruction uses a deterministic parser that matches the observed Tampa SUV / 30k / AWD / CarPlay reply)
- Quota system (casa `/api/search` returns quota; autos sample search does not)
- Custom domain / Vercel project wiring for this GitHub repo (the live project is already deployed from another source)

## Suggested next slice

1. Point the existing Vercel project at this GitHub repo (or import it) so source and production match.
2. Port casa’s Supabase family accounts if those keys belong on autos too.
3. Replace sample listings with a real Tampa inventory feed once the source of the live sample is known.
4. If an OpenAI/Anthropic key is added, swap `chatReply` for the same JSON matrix contract.
