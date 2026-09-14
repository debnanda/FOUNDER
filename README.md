# Founder

A pixel-art startup management simulation game.

Pick an idea and a founder
archetype, ship a product, build a team, and chase growth — all the way to an IPO, if the money
holds out.

Built as an Electron desktop app with Vite and TypeScript, with no runtime dependencies — the
entire simulation is hand-rolled.

## Overview

You start with $30,000 in savings, an idea, and a laptop. From there:

- **Product** : engineers generate dev points, split between shipping features and paying down
  tech debt via a focus slider. Feature work is fast but piles up debt, which drives churn and
  outages. Launch once the MVP bar fills.
- **Team** : hire engineers, designers, marketers, and sales from a rotating candidate pool.
  Morale drifts with crunch, perks, and cash trouble, and burned-out people quit.
- **Growth** : set a weekly marketing budget against a CAC that rises as you saturate the market;
  organic growth scales with product appeal and virality.
- **Money** : raise Pre-seed through Series B at metric-gated valuations, tracked on a live cap
  table that dilutes as you go.
- **Events** : press features, viral moments, outages, competitor launches, poaching attempts,
  and acquisition offers, most with a real trade-off attached.

Reach a $100M valuation and $400k MRR to IPO, accept a strong acquisition offer, or just try to
avoid running out of runway. Full rules and a step-by-step walkthrough are in
[HOW_TO_PLAY.md](HOW_TO_PLAY.md), and the same guide is built into the game itself — open
**How to Play** from the title screen.

## Getting started

Requires [Node.js](https://nodejs.org/) 18 or later.

```sh
npm install
npm start
```

This builds the app and launches it in Electron.

## Controls

Time moves in weekly ticks.

- `Space` — pause / resume
- `1` / `2` / `3` — set simulation speed

Progress autosaves to local storage every 4 in-game weeks.

## Project structure

```
src/game/     pure simulation — types, static data, weekly tick engine, event deck, actions & save
src/ui/       DOM renderer and SVG charts
electron/     desktop shell (main process)
scripts/      headless balance sim and a visual smoke test
```

The simulation in `src/game/` has no DOM dependency and is fully testable in isolation from the
UI layer.

## Balance testing

`scripts/sim.ts` plays the game headlessly under a fixed "reasonably attentive founder" strategy
across many seeded runs, then asserts on the outcome distribution — bankruptcy rate, how many
runs reach solid traction, whether the MVP launches in a sane timeframe. It exists to catch
balance regressions (an accidentally crushing cost curve, a funding round that's unreachable in
time) the same way a unit test catches a logic regression. Run it after any change to
`src/game/data.ts` or `src/game/engine.ts`:

```sh
npx tsx scripts/sim.ts
```

## Contributing

Issues and pull requests are welcome — balance tweaks, bug fixes, new events, new ideas to found a
company around. If you're changing the simulation's numbers, run `scripts/sim.ts` before and after
so the balance impact is visible in the PR.

## License

Released under the [MIT License](LICENSE).
