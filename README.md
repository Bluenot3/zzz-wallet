# ZEN Treasury Wallet — Design Source

Source for the ZEN Treasury Wallet, a multi-directional visual design system built as a
[Claude "Design" artifact](https://claude.ai) (multi-artboard canvas + live WebGL/SVG
components). Built by [ZEN AI Co.](https://zenai.world) for the Arsenal platform
(https://arsenal.world).

**Live artifact:** https://claude.ai/artifact/QeQ4q9t62q4xeygR2Y3xyo

## What this is

Four progressively more ambitious visual directions for the same wallet product — a
mobile treasury/portfolio app for holding and sending digital assets — each a complete,
independent set of screens (vault/home, send/agent flow, ledger/analytics, a
certificate/proof-of-reserve view, a materials/design-system board, and a desktop
layout), all cross-linked through an in-app theme switcher so a viewer can toggle
between them live.

| # | Codename | Aesthetic | Status |
|---|----------|-----------|--------|
| I | **Treasury** | Classic dark fintech — deep obsidian, brushed metal, precise data | Legacy (toggleable) |
| II | **Sovereign** | Polymer banknote — engraved guilloché, lathe rings, foil ink | Legacy (toggleable) |
| III | **Zenith** | Real-time armillary sphere — orbital rings, thin-film titanium, glass, bloom | Live |
| IV | **Vellum** | Parchment + hologram — liquid glass, wax seals, diffraction-grating kinegram | **Default** |

Each direction after the first was generated as a full creative escalation on the last,
while keeping every earlier direction live and selectable — nothing was thrown away.

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
brand/                        ZEN mark source (SVG/PNG + generator)
```

## The two custom rendering engines

Both are dependency-free, hand-written WebGL1 engines (no three.js) built specifically
for this project:

- **`directions/III-zenith/assets/zenith-core.js`** — real-time orbital-ring renderer.
  Rings are colored by a thin-film-interference spectral shader (the color comes from
  simulated oxide thickness, not a texture), composited with a custom 4-pass growing-
  radius bloom pipeline and a refractive glass orb.
- **`directions/IV-vellum/assets/vellum-holo.js`** — real-time diffraction-grating
  hologram renderer. Canvas-baked relief textures feed a spectral grating shader that
  shifts rainbow bands with device tilt, plus a tilt-driven kinegram frame-swap and
  micro-facet glitter.

Both expose a small `mount(canvas, opts) → { set(), renderAt(), destroy() }` API and are
paired everywhere with a deterministic pre-rendered poster frame that crossfades to the
live canvas once it's ready (accessibility / low-power / `prefers-reduced-motion` safe).

## Notes

- Balances, transaction history, and reserve figures shown in the boards are illustrative
  sample data, not real account data.
- The liquid-glass (`feDisplacementMap`) and some WebGL effects render best in
  Chromium-based browsers; other engines get graceful fallbacks.
- `qa/` folders contain the Playwright-based visual QA harness used to render every
  interactive state before each publish; the full screenshot set isn't included here,
  only a few reference renders per direction.

---
Built by [ZEN AI Co.](https://zenai.world) · [Arsenal](https://arsenal.world) · [AI Pioneer Program](https://www.zenai.world/ailiteracyyouth)
