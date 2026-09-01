# Shortlist Autos

Score cars against must-haves you set in chat. This repo reconstructs the live Tampa demo at [shortlist.autos](https://shortlist.autos) / [shortlist-autos.vercel.app](https://shortlist-autos.vercel.app).

Sister product: homes at [shortlist.casa](https://shortlist.casa).

## What it does

- Demo sign-in (`Continue in demo mode`)
- Chat sets a must-have matrix (area, body, budget, miles, year, AWD, seats, CarPlay, tow, fuel)
- Sample Tampa-area listings scored in a photo **Gallery** (default) or map **Split view**
- Copy a compressed share link (`/s#s1.…`)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — enter demo mode, then talk to Chat.

```bash
npm test
npm run build
```

Live inventory uses `MARKETCHECK_API_KEY` (the MarketCheck **API Key**, not the client secret). Copy `.env.example` to `.env.local` and run `npm run check:marketcheck` to confirm the key works. That command prints status and a sample heading; it never prints the full key.

## Notes

The GitHub repo was empty except a stub README. The previous agent session’s handoff file was never pushed. Product behavior was reverse-engineered from the public Vercel deployment. See `AGENTS.md`.
