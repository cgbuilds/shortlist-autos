# Shortlist Autos

Score cars against must-haves you set in chat. This repo reconstructs the live Tampa demo at [shortlist.autos](https://shortlist.autos) / [shortlist-autos.vercel.app](https://shortlist-autos.vercel.app).

Sister product: homes at [shortlist.casa](https://shortlist.casa).

## What it does

- Demo sign-in (`Continue in demo mode`)
- Chat sets a must-have matrix (area, body, budget, miles, year, AWD, seats, CarPlay, tow, fuel)
- First screen is a small chat over an empty Gallery list. Location is already set. Search pulls the scored shortlist. Split (map) is optional.
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

## Notes

The GitHub repo was empty except a stub README. The previous agent session’s handoff file was never pushed. Product behavior was reverse-engineered from the public Vercel deployment. See `AGENTS.md`.
