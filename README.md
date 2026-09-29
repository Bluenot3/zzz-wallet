# ZEN Treasury Wallet — Design Source

Source for the ZEN Treasury Wallet, a multi-directional visual design system built as a
[Claude "Design" artifact](https://claude.ai) (multi-artboard canvas + live WebGL/SVG
components). Built by [ZEN AI Co.](https://zenai.world) for the Arsenal platform
(https://arsenal.world).

**Live artifact:** https://claude.ai/artifact/QeQ4q9t62q4xeygR2Y3xyo

## What this is

Five progressively more ambitious visual directions for the same wallet product — a
mobile treasury/portfolio app for holding and sending digital assets — each a complete,
independent set of screens (vault/home, send/agent flow, ledger/analytics, a
certificate/proof-of-reserve view, a materials/design-system board, and a desktop
layout), all cross-linked through an in-app theme switcher so a viewer can toggle
between them live.

| # | Codename | Aesthetic | Status |
|---|----------|-----------|--------|
| I | **Treasury** | Classic dark fintech — deep obsidian, brushed metal, precise data | Legacy (toggleable) |
| II | **Sovereign** | Polymer banknote — engraved guilloché, lathe rings, foil ink | Legacy (toggleable) |
| III | **Zenith** | Real-time armillary sphere — orbital rings, thin-film titanium, glass, bloom | Legacy (toggleable) |
| IV | **Vellum** | Parchment + hologram — liquid glass, wax seals, diffraction-grating kinegram | Legacy (toggleable) |
| V | **Meridian** | Best-of synthesis of I–IV on a refined armillary core, extended past wallet/chat into analytics, ledger, and a codified system | **Main series** — the canvas opens on the Meridian Vault |

Each direction after the first was generated as a full creative escalation on the last,
while keeping every earlier direction live and selectable — nothing was thrown away.
Direction V is not a reset: it evolves III's live WebGL armillary engine (a second,
finer engraved-guilloché ring frequency and a cooler steel base tone synthesized from
II) and keeps IV's compact multi-series theme switcher. Meridian is the main series;
I–IV are legacy themes, still one tap away.

### Meridian's seven boards

| Board | What it does |
|---|---|
| **Vault** | Home: live armillary core (ORBIT ⇄ ALLOC), rolling balance, positions with 24h change |
| **Navigator** | Voice/text intent → plotted transfer → press-and-hold to align (1.4 s commit) |
| **Activity** | Ledger grouped by day — live search, In / Out / Pending filters, scrollable list, empty state |
| **Appearance** | Theme switch across all five series, motion and live-core settings |
| **Instrument Panel** | Range-scoped analytics (1M / 3M / 6M): daily reserve vs. contributions with an earned band, crosshair + keyboard inspection, chart ⇄ table view, a Sankey of sources → treasury → positions, stress tests, live strip |
| **Command** (desktop) | Vault + Navigator in one screen, allocation-vs-policy drift readout, positions table |
| **System** | The spec: core anatomy, measured color tokens (OKLCH + contrast), type, live components, animated motion curves, I→V lineage |

The analytics run on one internally consistent book of record (illustrative data): the
same deposits, disbursements, and yield reconcile across the Instrument Panel, Activity
ledger, Navigator, and Command boards. The asset palette was checked with a
colorblind-separation validator (worst adjacent pair ΔE 19.9 protan; every token ≥ 7:1
contrast on the chart surface); USD is the steel ring and deliberately neutral, so every
chart carries direct labels and a legend.

## Repo layout

```
project/canvas.json          the authoritative, currently-published canvas
                              (boards, page order, launch/default page)
directions/
  I-treasury/                original dark-fintech direction (5 boards)
    src/                     Main / Agent / Send / Materials / Desktop .dc.html
  II-sovereign/               polymer-banknote direction (5 boards)
    src/                     Sovereign-Vault / -Agent / -Dial / -Anatomy / -Desktop
    gen/                     guilloché / lathe-ring generators (Python) + SVG output
  III-zenith/                 armillary-sphere direction (6 boards)
    src/                     Zenith-Vault / -Agent / -Flows / -Appearance / -System / -Desktop
    assets/                  zenith-core.js (custom WebGL1 engine) + procedural art
    gen/                     pattern / build scripts (Python)
    project/, publish/       built .dc.html output (dev + publish-ready)
    qa/                      Playwright QA harness + a few reference screenshots
  IV-vellum/                  parchment-hologram direction (6 boards)
    src/                     Vellum-Vault / -Seal / -Ledger / -Certificate / -Atelier / -Desktop
    assets/                  vellum-holo.js (custom WebGL1 hologram engine) + procedural art
    gen/, project/, publish/, qa/   same pattern as III
  V-meridian/                 main series — best-of-synthesis direction (7 boards)
    src/                     Meridian-Vault / -Navigator / -Activity / -Appearance /
                              -Infographics (Instrument Panel) / -Desktop / -System
    assets/                  meridian-core.js (zenith-core.js fork: 2nd guilloché ring
                              frequency, cooler steel base) + procedural art
    gen/                     build script (Python) + blob_ids.json (published asset map)
    project/, publish/       built .dc.html output (dev + publish-ready)
    qa/                      Playwright QA harness + a few reference screenshots
brand/                        ZEN mark source (SVG/PNG + generator)
```

## The rendering engines

Dependency-free, hand-written WebGL1 engines (no three.js) built specifically for this
project:

- **`directions/III-zenith/assets/zenith-core.js`** — real-time orbital-ring renderer.
  Rings are colored by a thin-film-interference spectral shader (the color comes from
  simulated oxide thickness, not a texture), composited with a custom 4-pass growing-
  radius bloom pipeline and a refractive glass orb.
- **`directions/IV-vellum/assets/vellum-holo.js`** — real-time diffraction-grating
  hologram renderer. Canvas-baked relief textures feed a spectral grating shader that
  shifts rainbow bands with device tilt, plus a tilt-driven kinegram frame-swap and
  micro-facet glitter.
- **`directions/V-meridian/assets/meridian-core.js`** — synthesis fork of `zenith-core.js`
  adding a second, finer engraved-guilloché tick ring (borrowed from II's lathe-ring
  language) and a cooler "precision-steel" base tone.

Each engine exposes a small `mount(canvas, opts) → { set(), renderAt(), destroy() }` API
and is paired everywhere with a deterministic pre-rendered poster frame that crossfades
to the live canvas once it's ready (accessibility / low-power / `prefers-reduced-motion`
safe).

## Notes

- Balances, transaction history, and reserve figures shown in the boards are illustrative
  sample data, not real account data.
- The liquid-glass (`feDisplacementMap`) and some WebGL effects render best in
  Chromium-based browsers; other engines get graceful fallbacks.
- `qa/` folders contain the Playwright-based visual QA harness used to render every
  interactive state before each publish; the full screenshot set isn't included here,
  only a few reference renders per direction. To run a harness locally, unpack
  `react@18.3.1`, `react-dom@18.3.1` and `@babel/standalone@7.29.0` from npm into
  that direction's `qa/pk/` (the harness serves them in place of the CDN).

---
Built by [ZEN AI Co.](https://zenai.world) · [Arsenal](https://arsenal.world) · [AI Pioneer Program](https://www.zenai.world/ailiteracyyouth)
