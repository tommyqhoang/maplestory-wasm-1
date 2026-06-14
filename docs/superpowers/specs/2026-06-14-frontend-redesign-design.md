# Frontend Redesign — Design Spec

**Date:** 2026-06-14
**Status:** Approved (pending written-spec review)
**Goal:** Redesign the entire game frontend of the MapleStory WASM client to professional, playable quality — crisp, modern, readable, responsive — without rewriting the C++/WASM game engine that renders the world.

---

## 1. Background & problem

The client is a C++ MapleStory engine (the "Journey"/MapleStory-Client lineage) compiled to WebAssembly, rendering into a `<canvas>` via WebGL. **All** UI — login, character select, HUD, inventory, dialogs, menus — is drawn *inside* that canvas using low-resolution WZ-derived bitmap primitives and a baked font atlas.

Earlier work this session improved things incrementally: a sharp-bilinear upscale pipeline (crisp world rendering), crisp FreeType HP/MP/EXP text, and an HD-asset override system for in-canvas UI. These help, but the in-canvas UI has a hard quality ceiling: it is bounded by the engine's primitives, is not resolution-independent or accessible, and is slow to iterate (every change is a 3–4 min WASM rebuild). The result is still not "playable quality."

**Decision:** move the UI out of the canvas into a modern DOM layer.

## 2. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| UI architecture | **DOM overlay** over the game canvas | Resolution-independent, crisp, accessible, fast iteration; the canvas keeps rendering only the world. |
| Tech stack | **React + TypeScript + Vite** | Component model suits complex stateful game UI; TS makes the WASM↔JS bridge safe; standard, maintainable. |
| Visual direction | **Modern MapleStory-inspired** | Keep MapleStory's warm, playful identity; execute it crisply and professionally. |
| Cutover | **Strangler pattern**, surface by surface | Game stays runnable throughout; no big-bang rewrite. |

Guiding pillars (apply to every choice): **best practice, modern, easy maintenance, scale.**

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│  React/TS UI layer (DOM, on top)            │  login, char select, HUD,
│  pointer-events: none, except real widgets  │  inventory, dialogs, menus
├─────────────────────────────────────────────┤
│  <canvas> — C++/WASM engine                 │  game world ONLY
│  (existing sharp-upscale pipeline retained) │  + world-locked overlays
└─────────────────────────────────────────────┘
        ▲                          │
        │  commands (JS→C++)       │  state events (C++→JS)
        └──────── MapleBridge ─────┘
```

The overlay is a full-viewport container with `pointer-events: none`; only actual interactive widgets re-enable pointer events, so clicks on empty space fall through to the canvas (world interaction).

### Scope boundary

- **In DOM:** login, world/channel/character select, HUD (status bar, chat, menu buttons, minimap frame), inventory, equipment, stats, skills, NPC dialog, shops, quests, system/settings, keybindings, tooltips, notifications.
- **Stays in-engine (canvas):** the game world and *world-locked* overlays that track world coordinates every frame — floating damage numbers, monster/player nametags, chat balloons. Moving these to DOM would require per-frame coordinate sync of many nodes for no quality gain.

## 4. The bridge (`MapleBridge`)

A single **bidirectional, typed, versioned message bus**. No ad-hoc per-feature exports.

- **C++ → JS (state):** an engine-side `UiBridge` emits **on-change** (not per-frame) structured events: `scene` (login/charselect/ingame/loading), `stats`, `inventory`, `equipment`, `skills`, `chat`, `npcDialog`, `shop`, `quest`, `notice`, etc. Delivered through one `EM_ASM` call into `window.MapleBridge.recv(payload)`. A JS dispatcher validates and routes into the store.
- **JS → C++ (commands):** one exported C function `maple_bridge_send(const char* json)` (via `EMSCRIPTEN_KEEPALIVE`) that parses and dispatches typed commands: `login`, `selectWorld`, `selectChar`, `move`, `useSkill`, `attack`, `moveItem`, `equipItem`, `sendChat`, `openWindow`, `npcRespond`, `shopBuy`, etc.
- **Protocol = the contract.** Compact JSON. **Zod schemas in TS are the single source of truth**; a small build step generates a mirrored C++ header (message tags + field layout) from the same spec so the two sides cannot silently drift. Every message carries a `v` (version) and `t` (type) field. Messages are validated at the boundary; malformed messages are logged and dropped, never crash the UI.
- **Timing:** state events are coalesced per engine tick (dedupe by type) to avoid spamming the bridge; commands are sent immediately.

This is the linchpin for **scale**: new features add new message types, never new plumbing.

## 5. Project structure (feature-first)

```
web/ui/
  src/
    bridge/      transport, zod schema, codegen spec, typed send(), recv router, React hooks
    store/       Zustand slices per domain (scene, stats, inventory, chat, dialog, …)
    design/      tokens (color/space/type/motion), primitives:
                 Panel, Window(draggable), GaugeBar, ItemSlot, Button, Tooltip, Modal, Icon
    features/
      login/  charselect/  hud/  inventory/  equipment/  stats/
      skills/  dialog/  shop/  quest/  system/  minimap/  notifications/
    app/         root, scene routing, overlay layout, error boundary
  index.html  vite.config.ts  tsconfig.json(strict)  package.json
scripts/        build wiring so Vite output is served by the static server + Docker
```

Each `features/*` module owns its components, selectors and styles and depends only on `bridge`, `store`, `design`. A feature can be understood and changed in isolation.

## 6. Engineering practices (best practice / maintainable)

- **TypeScript strict**; ESLint + Prettier; existing C++ `clang-format` respected.
- **State:** Zustand with fine-grained selectors — a HP tick re-renders only the HP bar.
- **Performance:** on-change bridge events; per-feature code-splitting (lazy routes); memoized selectors; no per-frame React renders.
- **Testing:** Vitest (logic + components), Playwright (end-to-end flows incl. login→in-game, reusing the existing test harness/credentials), optional Storybook for building panels in isolation.
- **Accessibility:** focus management and keyboard navigation built into primitives.
- **i18n-ready / theme-ready:** copy and tokens centralized so localization and reskins are additive.

## 7. Design system (modern MapleStory, done once)

- **Design tokens** (CSS variables + a TS theme object) drive color, spacing, typography, radius, shadow, motion. One place to tune the whole look; themes/skins become additive later.
- **Primitives** every feature composes: `Panel`, `Window` (drag/stack/close), `GaugeBar`, `ItemSlot`, `Button`, `Tooltip`, `Modal`, `Icon`. Consistency for free.
- Real web fonts, CSS transitions/animations, responsive scaling to any viewport/resolution.
- HD UI art (where bitmap art is wanted) authored as standard web assets — no longer constrained by the WZ atlas.

## 8. Phasing (each phase shippable, game always runnable)

- **Phase 0 — Foundation:** Vite/React/TS under `web/ui`; build wired into the static server + Docker; `MapleBridge` skeleton + Zod schema + C++ `UiBridge`; prove one round-trip (DOM button → C++ log; live HP value C++ → DOM). Nothing user-facing replaced yet.
- **Phase 1 — HUD:** status bar (HP/MP/EXP/level), menu buttons, chat → DOM; disable in-engine status bar. Proves real-time state + commands end-to-end.
- **Phase 2 — Entry flow:** login, world/channel select, character select → fully DOM (canvas idle here). Highest-visibility professional win.
- **Phase 3 — Core windows:** inventory, equipment, stats, skills.
- **Phase 4 — Interactions:** NPC dialog, shops, quests, confirmations, system/settings menu.
- **Phase 5 — Polish:** minimap chrome/frame (the rendered map terrain may stay engine-drawn initially; only the panel, controls and player-position readout move to DOM), buff icons, notifications, keybindings, tooltips, motion pass, design-system audit.

## 9. Success criteria

- Crisp, resolution-independent UI at any window size; readable at a glance (HP/MP, item counts, dialog text).
- Login → character select → in-game → core windows all in DOM, visually cohesive under the modern-MapleStory design system.
- Game remains fully playable after every phase; world rendering unchanged.
- UI changes iterate without a WASM rebuild (only bridge-surface changes need an engine rebuild).
- Lint/tests/e2e green; bridge messages schema-validated both directions.

## 10. Risks & mitigations

- **Bridge drift between C++ and TS** → single Zod source of truth + generated C++ header + versioned messages.
- **Input routing (DOM vs canvas)** → strict `pointer-events` discipline; explicit focus ownership when a modal is open; keyboard routing rules (UI captures when a field/modal is focused, else world).
- **JSON cost / WASM compile time** → coalesced on-change events; if a single-header JSON lib hurts compile time, fall back to a hand-rolled typed encoder (protocol shape unchanged).
- **Scope creep** → strict phase gates; world-locked overlays explicitly out of scope.
- **Build/deploy integration** → Phase 0 fully wires Vite output into the Python static server + Docker before any feature work.

## 11. Out of scope

- Rewriting the C++ rendering/engine or the network/packet layer.
- World-locked overlays (damage numbers, nametags, chat balloons).
- Cash shop (per project direction).
- New gameplay features beyond what the engine already supports.
