# CLAUDE.md

Guidance for Claude Code when working in this repository. Read `AGENTS.md` for the
authoritative build/run/coding rules — they are not repeated here. This file is the
fast map of how the pieces fit together.

## What this is

A WebAssembly port of the MapleStory v83 client, playable in the browser against a
**Cosmic** server. Two cooperating halves run in the browser:

- **WASM engine** — the C++ client (`src/client/`) compiled with Emscripten, rendering
  the game world to a WebGL `<canvas>`.
- **DOM UI overlay** — a React + TypeScript + Vite app (`web/ui/`) rendered as crisp HTML
  over the canvas (login, world/char select, HUD, chat, inventory/equip/skills/stats/
  shop/NPC windows, system menu + settings).

They communicate over the **MapleBridge**: a versioned, Zod-validated JSON protocol.

## Hard rules (see AGENTS.md for full text)

- **Client-only project.** Never change server behavior; assume Cosmic works as-is. New
  features must reuse existing server infra and modify the client only.
- **Never touch `assets/`.** Treat it as read-only input data — no edits, moves, renames,
  or regeneration.
- Don't change build commands to work around a missing local dependency — use the
  documented Docker fallback instead.
- Builds must succeed **with no warnings**. No license/credit/journey-client comments in
  source. Comments explain *why*, not *what*.

## Layout

| Path | What lives here |
|------|-----------------|
| `src/client/` | C++ engine — `Graphics/`, `Net/` (handlers), `IO/`, `Gameplay/`, `Audio/`, `Character/`, `LazyFS/` |
| `src/client/IO/UiBridge.{h,cpp}` | C++ side of the MapleBridge |
| `src/client/IO/UiBridgeProtocol.h` | **Generated** protocol constants — do not hand-edit |
| `src/nlnx/` | Shared NX asset-loading library |
| `web/ui/src/bridge/` | MapleBridge: `protocol.spec.json` (source of truth), `protocol.ts`, `MapleBridge.ts` |
| `web/ui/src/store/` | Zustand game-state store |
| `web/ui/src/design/` | Window / Tooltip / AssetImage primitives + design tokens |
| `web/ui/src/features/` | Feature components (one folder per UI surface) |
| `web/ui/e2e/` | Playwright round-trip specs (run against `:8000`) |
| `web/server.py`, `ws_proxy.py`, `assets_server.py` | HTTP host, game-packet WS↔TCP proxy, NX asset streaming |
| `web/index.html` | Canvas + UI host page; render-scale / resize / keyboard-isolation logic |
| `web/hd/`, `web/hd_assets.js` | HD asset override system (sprite replacements) |
| `docs/ms-network-protocol.md` | Network protocol reference (cross-check before packet work) |

## Build & test

```bash
# Engine (prefer local; Docker fallback if toolchain missing)
./scripts/build_wasm.sh            # --debug / --jobs N
./scripts/docker_build_wasm.sh

# UI overlay (regenerates protocol header, type-checks, emits web/ui/dist)
./scripts/build_ui.sh

# UI dev loop
cd web/ui && npm install && npm run dev   # Vite HMR :5173, proxies to :8000
npm test            # Vitest unit tests
npm run e2e         # Playwright vs :8000
npm run lint        # ESLint + Prettier
npm run gen:protocol  # regenerate src/client/IO/UiBridgeProtocol.h from the spec
```

### Run the stack

Local: `python3 web/server.py`, `python3 web/ws_proxy.py --ws-port 8080`,
`python3 web/assets_server.py --port 8765 --directory .` → open `http://localhost:8000`.
Docker: `./scripts/run_all.sh` (stop with `./scripts/stop_all.sh`). The WS proxy is
assumed to forward to a running Cosmic server.

## Working on the bridge

`web/ui/src/bridge/protocol.spec.json` is the **single source of truth**. After editing it:

1. `npm run gen:protocol` (or `build_ui.sh`) regenerates `src/client/IO/UiBridgeProtocol.h`.
2. Commit the regenerated header alongside the spec change.
3. Bump `PROTOCOL_VERSION` if you make a breaking change; keep TS and C++ in lockstep.

Inbound payloads are validated before touching the store — malformed messages are dropped
with a warning, never allowed to corrupt state. Mirror that defensiveness in new handlers.

## Gotchas

- Two build systems: engine (CMake/Emscripten → `build/`) and UI (Vite → `web/ui/dist/`).
  A UI-only change does **not** require rebuilding the WASM engine, and vice versa.
- The engine reads `localStorage` render-quality seeds (e.g. `maple.supersample`) set early
  in `web/index.html`; canvas backing-store / supersample defaults are tuned for crisp
  native rendering — be careful changing them.
