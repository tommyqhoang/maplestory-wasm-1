# Frontend Redesign — Phase 0 (Foundation + Bridge) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a React/TypeScript/Vite DOM-overlay UI app over the WASM game canvas, with a typed, versioned, schema-validated `MapleBridge` proven end-to-end by a live round-trip (DOM → C++ and C++ → DOM), wired into the existing static-server + Docker build.

**Architecture:** A full-viewport React overlay (`pointer-events:none` except real widgets) renders on top of the existing `<canvas>`. A single bidirectional message bus connects the two: C++ emits on-change JSON state via `EM_ASM` into `window.MapleBridge.recv`; JS sends JSON commands via an exported `maple_bridge_send`. Zod schemas in TS are the single source of truth for the protocol. No engine rendering changes; no in-engine UI is removed in Phase 0.

**Tech Stack:** React 18, TypeScript (strict), Vite, Zustand, Zod, Vitest, Playwright. C++/Emscripten engine (existing). `nlohmann/json` single-header for C++ JSON.

**Reference context:**
- Spec: `docs/superpowers/specs/2026-06-14-frontend-redesign-design.md`
- Engine main loop: `src/client/Journey.cpp` (`update()`/`draw()`); existing JS export `_wasm_set_canvas_size`.
- Build: `./scripts/docker_build_wasm.sh -j 8` (incremental; writes root-owned `build/` which the live stack serves). Emscripten link flags in `src/client/CMakeLists.txt`.
- Live stack: Cosmic + web on Docker; open http://localhost:8000. Test login: account `wasmteswasmt` / `test1234`, PIC `1010`.
- Host page that boots WASM: `web/index.html`. Static server serves repo root (`web/server_fast.py`).

---

## File structure (created/modified in Phase 0)

**Created — UI app (`web/ui/`):**
- `web/ui/package.json` — deps + scripts (dev, build, test, lint)
- `web/ui/tsconfig.json` — strict TS config
- `web/ui/vite.config.ts` — build to `web/ui/dist` with stable entry names; dev server with COOP/COEP + proxy to :8000/:8080
- `web/ui/index.html` — dev host page (boots WASM + mounts React)
- `web/ui/src/main.tsx` — React entry, mounts overlay into `#maple-ui-root`
- `web/ui/src/app/App.tsx` — overlay root layout
- `web/ui/src/app/App.css` — overlay base styles (`pointer-events` discipline)
- `web/ui/src/bridge/protocol.ts` — Zod schemas: envelope + Phase-0 messages
- `web/ui/src/bridge/protocol.spec.json` — machine-readable message list (source for C++ codegen)
- `web/ui/src/bridge/MapleBridge.ts` — transport: `recv()`, `send()`, dispatcher
- `web/ui/src/bridge/useBridge.ts` — React hook + store wiring
- `web/ui/src/store/store.ts` — Zustand store (scene + stats slices for Phase 0)
- `web/ui/src/bridge/MapleBridge.test.ts` — Vitest unit tests
- `web/ui/src/store/store.test.ts` — Vitest unit tests
- `web/ui/scripts/gen-cpp-protocol.mjs` — generates the C++ protocol header from `protocol.spec.json`
- `web/ui/e2e/roundtrip.spec.ts` — Playwright end-to-end round-trip test
- `web/ui/playwright.config.ts`

**Created — engine bridge (`src/client/`):**
- `src/client/IO/UiBridge.h` / `UiBridge.cpp` — `UiBridge` singleton: `emit()` + inbound command dispatch + `maple_bridge_send` export
- `src/client/includes/json/json.hpp` — vendored `nlohmann/json` single header
- `src/client/IO/UiBridgeProtocol.h` — generated message-type constants (from `gen-cpp-protocol.mjs`)

**Modified:**
- `src/client/Journey.cpp` — call `UiBridge::get().poll_emit()` once per tick; emit `scene`/`stats` on change
- `src/client/IO/UIStateGame.cpp` (or `CharStats`) — emit `stats` when HP/MP/level/exp change (Phase 0: poll-and-diff in `UiBridge`)
- `src/client/CMakeLists.txt` — only if sources are listed explicitly: add `IO/UiBridge.cpp`. No `EXPORTED_FUNCTIONS` change — `maple_bridge_send` exports via `EMSCRIPTEN_KEEPALIVE` like `wasm_set_canvas_size`. `ccall` already exported.
- `web/index.html` — add `#maple-ui-root` overlay div + `<script type="module" src="/web/ui/dist/maple-ui.js">` and stylesheet
- `.gitignore` — ignore `web/ui/node_modules`, `web/ui/dist` build artifacts as appropriate (keep dist out of git; built in CI/Docker)
- `docker-compose.yml` / build wiring — run `vite build` before/with the html-server (a build step), so `web/ui/dist` exists

---

## Task 1: Scaffold the Vite/React/TS app

**Files:**
- Create: `web/ui/package.json`, `web/ui/tsconfig.json`, `web/ui/vite.config.ts`, `web/ui/index.html`, `web/ui/src/main.tsx`, `web/ui/src/app/App.tsx`, `web/ui/src/app/App.css`

- [ ] **Step 1: Create `web/ui/package.json`**

```json
{
  "name": "maple-ui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint . && prettier --check .",
    "gen:protocol": "node scripts/gen-cpp-protocol.mjs",
    "e2e": "playwright test"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.2",
    "vitest": "^2.0.5",
    "jsdom": "^24.1.1",
    "@playwright/test": "^1.46.1",
    "eslint": "^9.9.0",
    "prettier": "^3.3.3"
  }
}
```

- [ ] **Step 2: Create `web/ui/tsconfig.json` (strict)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "e2e", "scripts"]
}
```

- [ ] **Step 3: Create `web/ui/vite.config.ts`**

The build emits stable, unhashed entry names so `web/index.html` can reference them without a manifest. Dev server sets the COOP/COEP headers the WASM runtime needs and proxies engine assets + websocket to the running Docker stack.

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const COOP_COEP = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

// Proxy engine assets to the Docker stack so `vite dev` can run the real game.
const proxyTarget = "http://localhost:8000";
const proxy = Object.fromEntries(
  ["/build", "/web", "/hd", "/nxFiles", "/wz"].map((p) => [
    p,
    { target: proxyTarget, changeOrigin: true },
  ]),
);

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, headers: COOP_COEP, proxy },
  preview: { headers: COOP_COEP },
  test: { environment: "jsdom", globals: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "maple-ui.js",
        assetFileNames: "maple-ui.[ext]",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
```

- [ ] **Step 4: Create `web/ui/src/app/App.css`**

```css
#maple-ui-root {
  position: fixed;
  inset: 0;
  z-index: 5;
  pointer-events: none; /* clicks fall through to the canvas by default */
}
#maple-ui-root .ui-interactive {
  pointer-events: auto; /* real widgets opt back in */
}
.phase0-probe {
  position: fixed;
  top: 12px;
  left: 12px;
  font: 13px/1.4 system-ui, sans-serif;
  color: #fff;
  background: rgba(10, 13, 19, 0.8);
  border: 1px solid #2a3140;
  border-radius: 8px;
  padding: 10px 12px;
}
.phase0-probe button {
  pointer-events: auto;
  margin-top: 6px;
}
```

- [ ] **Step 5: Create `web/ui/src/app/App.tsx` (placeholder; real probe added in Task 5)**

```tsx
export function App() {
  return null;
}
```

- [ ] **Step 6: Create `web/ui/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./app/App.css";

const el = document.getElementById("maple-ui-root");
if (el) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
```

- [ ] **Step 7: Create `web/ui/index.html` (dev host; boots WASM + mounts React)**

This dev page mirrors the production boot so `vite dev` runs the real engine with HMR for the UI. It references the proxied engine bundle and the same config flow as `web/index.html`.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MapleStory (dev)</title>
    <style>
      html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
      #canvas { display: block; outline: none; cursor: none; }
    </style>
  </head>
  <body>
    <canvas id="canvas" tabindex="-1"></canvas>
    <div id="maple-ui-root"></div>
    <script type="module" src="/src/main.tsx"></script>
    <script type="module">
      // Minimal engine boot for dev (assets proxied to :8000).
      window.Module = {
        canvas: document.getElementById("canvas"),
        print: (t) => console.log("[stdout]", t),
        printErr: (t) => console.error("[stderr]", t),
      };
      const s = document.createElement("script");
      s.src = "/build/JourneyClient.js";
      document.body.appendChild(s);
    </script>
  </body>
</html>
```

- [ ] **Step 8: Install deps and verify the dev build compiles**

Run:
```bash
cd web/ui && npm install && npm run build
```
Expected: `npm install` succeeds; `npm run build` produces `web/ui/dist/maple-ui.js` with no TS errors.

- [ ] **Step 9: Commit**

```bash
cd /home/th/Documents/GitHub/maplestory-wasm
echo "web/ui/node_modules/" >> .gitignore
echo "web/ui/dist/" >> .gitignore
git add web/ui/package.json web/ui/tsconfig.json web/ui/vite.config.ts web/ui/index.html web/ui/src .gitignore
git commit -m "feat(ui): scaffold Vite/React/TS overlay app"
```

---

## Task 2: Bridge protocol (Zod) — single source of truth

**Files:**
- Create: `web/ui/src/bridge/protocol.ts`, `web/ui/src/bridge/protocol.spec.json`

- [ ] **Step 1: Create `web/ui/src/bridge/protocol.spec.json`**

Machine-readable message list. `dir` = direction (`out` = C++→JS, `in` = JS→C++). This file is the source for both the Zod schemas (hand-mirrored) and the generated C++ header. Phase 0 messages only.

```json
{
  "version": 1,
  "messages": [
    { "type": "ping",  "dir": "in",  "fields": [{ "name": "nonce", "type": "int" }] },
    { "type": "pong",  "dir": "out", "fields": [{ "name": "nonce", "type": "int" }] },
    { "type": "scene", "dir": "out", "fields": [{ "name": "name", "type": "string" }] },
    { "type": "stats", "dir": "out", "fields": [
        { "name": "hp", "type": "int" }, { "name": "maxHp", "type": "int" },
        { "name": "mp", "type": "int" }, { "name": "maxMp", "type": "int" },
        { "name": "level", "type": "int" }, { "name": "exp", "type": "long" }
    ] }
  ]
}
```

- [ ] **Step 2: Create `web/ui/src/bridge/protocol.ts`**

```ts
import { z } from "zod";

export const PROTOCOL_VERSION = 1;

// Every message: { v: version, t: type, ...fields }
const base = { v: z.literal(PROTOCOL_VERSION) };

export const PongMsg = z.object({ ...base, t: z.literal("pong"), nonce: z.number().int() });
export const SceneMsg = z.object({ ...base, t: z.literal("scene"), name: z.string() });
export const StatsMsg = z.object({
  ...base, t: z.literal("stats"),
  hp: z.number().int(), maxHp: z.number().int(),
  mp: z.number().int(), maxMp: z.number().int(),
  level: z.number().int(), exp: z.number().int(),
});

// Inbound to engine (constructed by JS, validated before send).
export const PingMsg = z.object({ ...base, t: z.literal("ping"), nonce: z.number().int() });

export const InboundMsg = z.discriminatedUnion("t", [PongMsg, SceneMsg, StatsMsg]);
export const OutboundCmd = z.discriminatedUnion("t", [PingMsg]);

export type InboundMsg = z.infer<typeof InboundMsg>;
export type OutboundCmd = z.infer<typeof OutboundCmd>;
```

- [ ] **Step 3: Commit**

```bash
git add web/ui/src/bridge/protocol.ts web/ui/src/bridge/protocol.spec.json
git commit -m "feat(ui): bridge protocol schemas (phase 0 messages)"
```

---

## Task 3: Bridge transport + store (TDD)

**Files:**
- Create: `web/ui/src/store/store.ts`, `web/ui/src/bridge/MapleBridge.ts`, `web/ui/src/bridge/useBridge.ts`
- Test: `web/ui/src/bridge/MapleBridge.test.ts`, `web/ui/src/store/store.test.ts`

- [ ] **Step 1: Create the store `web/ui/src/store/store.ts`**

```ts
import { create } from "zustand";

export interface Stats {
  hp: number; maxHp: number; mp: number; maxMp: number; level: number; exp: number;
}

interface GameState {
  scene: string;
  stats: Stats;
  lastPong: number | null;
  setScene: (name: string) => void;
  setStats: (s: Stats) => void;
  setPong: (nonce: number) => void;
}

export const useGame = create<GameState>((set) => ({
  scene: "loading",
  stats: { hp: 0, maxHp: 0, mp: 0, maxMp: 0, level: 0, exp: 0 },
  lastPong: null,
  setScene: (name) => set({ scene: name }),
  setStats: (stats) => set({ stats }),
  setPong: (nonce) => set({ lastPong: nonce }),
}));
```

- [ ] **Step 2: Write the failing store test `web/ui/src/store/store.test.ts`**

```ts
import { useGame } from "./store";

test("setStats updates stats", () => {
  useGame.getState().setStats({ hp: 50, maxHp: 50, mp: 5, maxMp: 5, level: 1, exp: 0 });
  expect(useGame.getState().stats.hp).toBe(50);
  expect(useGame.getState().stats.maxMp).toBe(5);
});

test("setScene updates scene", () => {
  useGame.getState().setScene("ingame");
  expect(useGame.getState().scene).toBe("ingame");
});
```

- [ ] **Step 3: Run to verify pass (store already implemented)**

Run: `cd web/ui && npx vitest run src/store/store.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Write the failing bridge test `web/ui/src/bridge/MapleBridge.test.ts`**

```ts
import { MapleBridge } from "./MapleBridge";
import { useGame } from "../store/store";

function makeBridge() {
  const sent: string[] = [];
  const bridge = new MapleBridge((json) => sent.push(json));
  return { bridge, sent };
}

test("recv routes a valid stats message into the store", () => {
  const { bridge } = makeBridge();
  bridge.recv(JSON.stringify({ v: 1, t: "stats", hp: 30, maxHp: 50, mp: 2, maxMp: 5, level: 3, exp: 12 }));
  expect(useGame.getState().stats.hp).toBe(30);
  expect(useGame.getState().stats.level).toBe(3);
});

test("recv routes scene", () => {
  const { bridge } = makeBridge();
  bridge.recv(JSON.stringify({ v: 1, t: "scene", name: "charselect" }));
  expect(useGame.getState().scene).toBe("charselect");
});

test("recv ignores malformed messages without throwing", () => {
  const { bridge } = makeBridge();
  expect(() => bridge.recv("{ not json")).not.toThrow();
  expect(() => bridge.recv(JSON.stringify({ v: 1, t: "stats", hp: "x" }))).not.toThrow();
});

test("send validates and forwards a ping command as json", () => {
  const { bridge, sent } = makeBridge();
  bridge.send({ v: 1, t: "ping", nonce: 7 });
  expect(JSON.parse(sent[0])).toEqual({ v: 1, t: "ping", nonce: 7 });
});

test("send throws on an invalid command", () => {
  const { bridge } = makeBridge();
  // @ts-expect-error invalid command shape
  expect(() => bridge.send({ v: 1, t: "ping" })).toThrow();
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `cd web/ui && npx vitest run src/bridge/MapleBridge.test.ts`
Expected: FAIL — `Cannot find module './MapleBridge'`.

- [ ] **Step 6: Implement `web/ui/src/bridge/MapleBridge.ts`**

```ts
import { InboundMsg, OutboundCmd, PROTOCOL_VERSION } from "./protocol";
import { useGame } from "../store/store";

type SendFn = (json: string) => void;

export class MapleBridge {
  constructor(private readonly transport: SendFn) {}

  // C++ -> JS. Tolerant: never throws on bad input.
  recv(json: string): void {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      console.warn("[bridge] dropped non-JSON message");
      return;
    }
    const parsed = InboundMsg.safeParse(raw);
    if (!parsed.success) {
      console.warn("[bridge] dropped invalid message", parsed.error.issues);
      return;
    }
    this.route(parsed.data);
  }

  // JS -> C++. Strict: throws if the caller built an invalid command.
  send(cmd: OutboundCmd): void {
    const checked = OutboundCmd.parse(cmd);
    this.transport(JSON.stringify(checked));
  }

  ping(nonce: number): void {
    this.send({ v: PROTOCOL_VERSION, t: "ping", nonce });
  }

  private route(msg: InboundMsg): void {
    const s = useGame.getState();
    switch (msg.t) {
      case "stats":
        s.setStats({
          hp: msg.hp, maxHp: msg.maxHp, mp: msg.mp, maxMp: msg.maxMp,
          level: msg.level, exp: msg.exp,
        });
        break;
      case "scene":
        s.setScene(msg.name);
        break;
      case "pong":
        s.setPong(msg.nonce);
        break;
    }
  }
}
```

- [ ] **Step 7: Run to verify pass**

Run: `cd web/ui && npx vitest run src/bridge/MapleBridge.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 8: Create `web/ui/src/bridge/useBridge.ts` (wires the singleton to the WASM Module)**

```ts
import { MapleBridge } from "./MapleBridge";

// Calls the exported C function with a JSON string via ccall.
function transportToEngine(json: string): void {
  const mod = (window as unknown as { Module?: { ccall?: (...a: unknown[]) => unknown } }).Module;
  if (mod?.ccall) {
    mod.ccall("maple_bridge_send", null, ["string"], [json]);
  } else {
    console.warn("[bridge] engine not ready, dropping command", json);
  }
}

export const bridge = new MapleBridge(transportToEngine);

// The engine calls window.MapleBridge.recv(json) via EM_ASM.
(window as unknown as { MapleBridge: MapleBridge }).MapleBridge = bridge;
```

- [ ] **Step 9: Commit**

```bash
git add web/ui/src/store web/ui/src/bridge
git commit -m "feat(ui): MapleBridge transport + store with unit tests"
```

---

## Task 4: C++ protocol codegen + UiBridge

**Files:**
- Create: `web/ui/scripts/gen-cpp-protocol.mjs`, `src/client/includes/json/json.hpp` (vendored), `src/client/IO/UiBridge.h`, `src/client/IO/UiBridge.cpp`, `src/client/IO/UiBridgeProtocol.h` (generated)
- Modify: `src/client/CMakeLists.txt`

- [ ] **Step 1: Create `web/ui/scripts/gen-cpp-protocol.mjs`**

Generates a C++ header of message-type string constants from `protocol.spec.json`, so type names cannot drift between TS and C++.

```js
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(resolve(here, "../src/bridge/protocol.spec.json"), "utf8"));

const lines = [
  "// AUTO-GENERATED from web/ui/src/bridge/protocol.spec.json — do not edit by hand.",
  "#pragma once",
  "namespace jrc { namespace bridge {",
  `constexpr int PROTOCOL_VERSION = ${spec.version};`,
];
for (const m of spec.messages) {
  const name = m.type.toUpperCase();
  lines.push(`constexpr const char* MSG_${name} = "${m.type}";`);
}
lines.push("}}");

const out = resolve(here, "../../../src/client/IO/UiBridgeProtocol.h");
writeFileSync(out, lines.join("\n") + "\n");
console.log("wrote", out);
```

- [ ] **Step 2: Run the generator and verify the header**

Run:
```bash
cd web/ui && node scripts/gen-cpp-protocol.mjs
cat ../../src/client/IO/UiBridgeProtocol.h
```
Expected: header lists `MSG_PING`, `MSG_PONG`, `MSG_SCENE`, `MSG_STATS`, and `PROTOCOL_VERSION = 1`.

- [ ] **Step 3: Vendor `nlohmann/json` single header**

Run:
```bash
cd /home/th/Documents/GitHub/maplestory-wasm
mkdir -p src/client/includes/json
curl -L -o src/client/includes/json/json.hpp \
  https://raw.githubusercontent.com/nlohmann/json/v3.11.3/single_include/nlohmann/json.hpp
head -5 src/client/includes/json/json.hpp
```
Expected: file downloaded; header comment shows the nlohmann/json banner.

- [ ] **Step 4: Create `src/client/IO/UiBridge.h`**

```cpp
//////////////////////////////////////////////////////////////////////////////
// MapleBridge: typed, versioned message bus between the WASM engine and the
// React/TS DOM UI. C++ emits state (emit_*), JS sends commands (maple_bridge_send).
//////////////////////////////////////////////////////////////////////////////
#pragma once
#include "../Template/Singleton.h"

#include <cstdint>
#include <string>

namespace jrc
{
    class UiBridge : public Singleton<UiBridge>
    {
    public:
        UiBridge();

        // Called once per engine tick: diff cached state and emit on change.
        void poll_emit();

        // Emit helpers (serialize + push to JS via EM_ASM).
        void emit_scene(const std::string& name);
        void emit_stats(int hp, int maxhp, int mp, int maxmp, int level, int64_t exp);
        void emit_pong(int nonce);

        // Dispatch an inbound command (JSON) from JS. Tolerant of bad input.
        void handle_command(const std::string& json);

    private:
        void push(const std::string& payload);

        // Cached last-emitted values for change detection.
        std::string scene_;
        int hp_ = -1, maxhp_ = -1, mp_ = -1, maxmp_ = -1, level_ = -1;
        int64_t exp_ = -1;
    };
}
```

- [ ] **Step 5: Create `src/client/IO/UiBridge.cpp`**

```cpp
#include "UiBridge.h"
#include "UiBridgeProtocol.h"

#include "../Console.h"
#include "UI.h"
#include "../Gameplay/Stage.h"
#include "../Character/Player.h"
#include "../Character/CharStats.h"

#include "json/json.hpp"

#ifdef MS_PLATFORM_WASM
#include <emscripten.h>
#endif

using json = nlohmann::json;

namespace jrc
{
    UiBridge::UiBridge() {}

    void UiBridge::push(const std::string& payload)
    {
#ifdef MS_PLATFORM_WASM
        EM_ASM({
            if (window.MapleBridge && typeof window.MapleBridge.recv === "function") {
                window.MapleBridge.recv(UTF8ToString($0));
            }
        }, payload.c_str());
#else
        (void)payload;
#endif
    }

    void UiBridge::emit_scene(const std::string& name)
    {
        json j = { {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_SCENE}, {"name", name} };
        push(j.dump());
    }

    void UiBridge::emit_stats(int hp, int maxhp, int mp, int maxmp, int level, int64_t exp)
    {
        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_STATS},
            {"hp", hp}, {"maxHp", maxhp}, {"mp", mp}, {"maxMp", maxmp},
            {"level", level}, {"exp", exp}
        };
        push(j.dump());
    }

    void UiBridge::emit_pong(int nonce)
    {
        json j = { {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_PONG}, {"nonce", nonce} };
        push(j.dump());
    }

    void UiBridge::handle_command(const std::string& jsonstr)
    {
        json j = json::parse(jsonstr, nullptr, false);
        if (j.is_discarded() || !j.contains("t") || !j["t"].is_string())
        {
            Console::get().print("[bridge] dropped invalid command");
            return;
        }
        const std::string t = j["t"].get<std::string>();
        if (t == bridge::MSG_PING)
        {
            int nonce = j.value("nonce", 0);
            emit_pong(nonce);
        }
        // Future command types dispatched here.
    }

    void UiBridge::poll_emit()
    {
        // Phase 0: emit player stats (only while in-game) when they change.
        // Player stats live on the Stage's player, not on UIStateGame.
        if (UI::get().get_state_game() == nullptr)
        {
            return;
        }
        const CharStats& st = Stage::get().get_player().get_stats();
        int hp = st.get_stat(Maplestat::HP);
        int mp = st.get_stat(Maplestat::MP);
        int maxhp = st.get_total(Equipstat::HP);
        int maxmp = st.get_total(Equipstat::MP);
        int level = st.get_stat(Maplestat::LEVEL);
        int64_t exp = st.get_exp();
        if (hp != hp_ || mp != mp_ || maxhp != maxhp_ || maxmp != maxmp_ ||
            level != level_ || exp != exp_)
        {
            hp_ = hp; mp_ = mp; maxhp_ = maxhp; maxmp_ = maxmp; level_ = level; exp_ = exp;
            emit_stats(hp, maxhp, mp, maxmp, level, exp);
        }
    }
}

#ifdef MS_PLATFORM_WASM
extern "C"
{
    // Exported to JS; called via Module.ccall("maple_bridge_send", ...).
    EMSCRIPTEN_KEEPALIVE void maple_bridge_send(const char* json)
    {
        jrc::UiBridge::get().handle_command(json ? json : "");
    }
}
#endif
```

> NOTE: `UI::get_state_game()` is a new accessor added in Task 5 Step 1 (returns the active `UIStateGame*` or `nullptr` — used here only as an in-game guard). `Stage::get().get_player().get_stats()` (returns `const CharStats&`), `Maplestat::HP/LEVEL`, `Equipstat::HP/MP`, and `CharStats::get_stat/get_total/get_exp` all already exist (the same calls power `UIStatusBar.cpp`). `Stage::get_player()` returns `Player&` (`Gameplay/Stage.h`).

- [ ] **Step 6: Ensure `UiBridge.cpp` is compiled (no export-list change needed)**

The existing `wasm_set_canvas_size` is exported purely via `extern "C" EMSCRIPTEN_KEEPALIVE` (`IO/Window.cpp:454`) with **no** `EXPORTED_FUNCTIONS` flag in `CMakeLists.txt`. `maple_bridge_send` uses the same `extern "C" EMSCRIPTEN_KEEPALIVE` form, so Emscripten keeps and exports it automatically. **Do not add an `EXPORTED_FUNCTIONS` list** — doing so would suppress the auto-kept symbols (including `_main`) and break the build.

Confirm `UiBridge.cpp` is picked up by the build. Check whether `CMakeLists.txt` globs sources:
```bash
grep -nE "GLOB|add_executable|IO/.*\.cpp|file\(" src/client/CMakeLists.txt | head
```
If sources are globbed (e.g. `file(GLOB_RECURSE ...)`), no edit is needed. If sources are listed explicitly, add `IO/UiBridge.cpp` to that list. `ccall` is already in `EXPORTED_RUNTIME_METHODS` (no change needed).

- [ ] **Step 7: Commit (build verified in Task 5)**

```bash
git add web/ui/scripts/gen-cpp-protocol.mjs src/client/includes/json/json.hpp \
        src/client/IO/UiBridge.h src/client/IO/UiBridge.cpp \
        src/client/IO/UiBridgeProtocol.h src/client/CMakeLists.txt
git commit -m "feat(engine): UiBridge message bus + generated protocol header"
```

---

## Task 5: Wire engine emit + accessors, and the round-trip probe UI

**Files:**
- Modify: `src/client/IO/UI.h`, `src/client/IO/UI.cpp`, `src/client/IO/UIStateGame.h`/`.cpp` (accessors), `src/client/Journey.cpp` (tick), `src/client/IO/UIStateLogin.cpp` (scene emit)
- Modify: `web/ui/src/app/App.tsx`

- [ ] **Step 1: Add the in-game guard accessor `UI::get_state_game()`**

`UI` holds `std::unique_ptr<UIState> state;` (verified, `IO/UI.h:95`). Add a public accessor that returns the active in-game state or `nullptr`.

In `src/client/IO/UI.h`, forward-declare and declare (inside `class UI`, public section):
```cpp
        // Returns the active in-game UI state, or nullptr if not in-game.
        UIStateGame* get_state_game() const;
```
Add near the top of `UI.h` (after existing includes) a forward declaration if `UIStateGame` is not already visible:
```cpp
    class UIStateGame;
```
In `src/client/IO/UI.cpp`, add the include and implementation:
```cpp
#include "UIStateGame.h"
// ...
    UIStateGame* UI::get_state_game() const
    {
        return dynamic_cast<UIStateGame*>(state.get());
    }
```
No change to `UIStateGame` is needed — the bridge reads player stats from `Stage::get().get_player().get_stats()`, not from `UIStateGame`.

- [ ] **Step 2: Call the bridge tick from the engine loop**

In `src/client/Journey.cpp`, inside `update()` (after `UI::get().update();`), add:
```cpp
        UiBridge::get().poll_emit();
```
And add the include at the top of `Journey.cpp`:
```cpp
#include "IO/UiBridge.h"
```

- [ ] **Step 3: Emit scene transitions**

Emit `"login"` when the login state is constructed and `"ingame"` when the game state is constructed. In `src/client/IO/UIStateLogin.cpp` constructor add:
```cpp
        UiBridge::get().emit_scene("login");
```
In `src/client/IO/UIStateGame.cpp` constructor add:
```cpp
        UiBridge::get().emit_scene("ingame");
```
Add `#include "UiBridge.h"` to both files.

- [ ] **Step 4: Replace the probe UI in `web/ui/src/app/App.tsx`**

```tsx
import { useGame } from "../store/store";
import { bridge } from "../bridge/useBridge";

export function App() {
  const scene = useGame((s) => s.scene);
  const stats = useGame((s) => s.stats);
  const lastPong = useGame((s) => s.lastPong);
  return (
    <div className="phase0-probe ui-interactive">
      <div>scene: {scene}</div>
      <div>HP: {stats.hp} / {stats.maxHp}</div>
      <div>MP: {stats.mp} / {stats.maxMp}</div>
      <div>last pong: {lastPong ?? "—"}</div>
      <button onClick={() => bridge.ping(Date.now() % 100000)}>ping engine</button>
    </div>
  );
}
```

- [ ] **Step 5: Build the engine**

Run: `./scripts/docker_build_wasm.sh -j 8`
Expected: `Build finished successfully.` (UiBridge compiles; export present).

- [ ] **Step 6: Build the UI and wire it into the production page**

Run: `cd web/ui && npm run build`
Then modify `web/index.html`: add inside `<body>` (after the `#container`) the overlay root and bundle:
```html
    <div id="maple-ui-root"></div>
    <link rel="stylesheet" href="/web/ui/dist/maple-ui.css" />
    <script type="module" src="/web/ui/dist/maple-ui.js"></script>
```
Expected: `web/ui/dist/maple-ui.js` and `maple-ui.css` exist.

- [ ] **Step 7: Commit**

```bash
git add src/client/IO/UI.h src/client/IO/UI.cpp src/client/IO/UIStateGame.h \
        src/client/IO/UIStateGame.cpp src/client/IO/UIStateLogin.cpp \
        src/client/Journey.cpp web/ui/src/app/App.tsx web/index.html
git commit -m "feat: wire UiBridge emit/scene + phase-0 probe overlay"
```

---

## Task 6: End-to-end round-trip verification (Playwright)

**Files:**
- Create: `web/ui/playwright.config.ts`, `web/ui/e2e/roundtrip.spec.ts`

- [ ] **Step 1: Create `web/ui/playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  use: { baseURL: "http://localhost:8000", headless: true },
});
```

- [ ] **Step 2: Create `web/ui/e2e/roundtrip.spec.ts`**

Verifies (a) the overlay mounts, (b) scene emits reach the DOM, (c) JS→C++→JS ping/pong round-trips. Uses the documented test login to reach in-game and confirm live stats.

```ts
import { test, expect } from "@playwright/test";

test("overlay mounts and shows a scene", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => typeof (window as any).Module?._wasm_set_canvas_size === "function", null, { timeout: 20000 });
  const probe = page.locator(".phase0-probe");
  await expect(probe).toBeVisible();
  await expect(probe).toContainText(/scene: (login|ingame|loading)/, { timeout: 15000 });
});

test("ping round-trips through the engine", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => typeof (window as any).Module?.ccall === "function", null, { timeout: 20000 });
  await page.getByRole("button", { name: "ping engine" }).click();
  await expect(page.locator(".phase0-probe")).toContainText(/last pong: \d+/, { timeout: 5000 });
});

test("live stats reach the overlay in-game", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => typeof (window as any).Module?._wasm_set_canvas_size === "function", null, { timeout: 20000 });
  await page.waitForTimeout(3500);
  const L = 40, S = 1.5, g = (x: number, y: number): [number, number] => [L + x * S, y * S];
  await page.mouse.click(...g(390, 261));
  await page.keyboard.type("wasmteswasmt", { delay: 35 });
  await page.keyboard.press("Tab");
  await page.keyboard.type("test1234", { delay: 35 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  await page.mouse.click(770, 312);
  await page.waitForTimeout(2500);
  await page.mouse.click(...g(130, 210));
  await page.waitForTimeout(700);
  await page.mouse.click(...g(626, 392));
  await page.waitForTimeout(4000);
  await expect(page.locator(".phase0-probe")).toContainText(/HP: \d+ \/ \d+/);
  await expect(page.locator(".phase0-probe")).not.toContainText("HP: 0 / 0");
});
```

- [ ] **Step 3: Restart the html-server container (pick up new web files) and run e2e**

The Docker html-server serves repo root; `web/index.html`, `web/ui/dist`, and `build/` are bind-mounted, so reloading the page is enough. Run:
```bash
cd web/ui && npx playwright install chromium && npx playwright test
```
Expected: 3 tests PASS. (If the engine build/asset load is slow on first run, the timeouts above accommodate it.)

- [ ] **Step 4: Commit**

```bash
git add web/ui/playwright.config.ts web/ui/e2e/roundtrip.spec.ts
git commit -m "test(ui): phase-0 bridge round-trip e2e"
```

---

## Task 7: Build/deploy integration

**Files:**
- Modify: `docker-compose.yml` (or a build script) so `web/ui/dist` is produced as part of bringing up the stack; document the dev workflow.
- Create: `web/ui/README.md`

- [ ] **Step 1: Add a UI build step to the stack**

Add a one-shot build (mirrors `docker_build_wasm.sh` pattern) so `web/ui/dist` exists before the html-server serves it. Create `scripts/build_ui.sh`:
```bash
#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../web/ui"
npm ci
npm run gen:protocol
npm run build
echo "UI build finished: web/ui/dist"
```
Make it executable: `chmod +x scripts/build_ui.sh`.

- [ ] **Step 2: Document the dev workflow in `web/ui/README.md`**

```markdown
# MapleStory DOM UI (overlay)

React + TypeScript + Vite UI rendered over the WASM game canvas.

## Dev (HMR)
1. Ensure the Docker stack is up (engine + assets at :8000).
2. `cd web/ui && npm install && npm run dev` → open http://localhost:5173
   (Vite proxies /build, /web, /hd to :8000 and sets COOP/COEP.)

## Production / integrated
- `./scripts/build_ui.sh` → outputs `web/ui/dist`, served by the Python server.
- `web/index.html` loads `/web/ui/dist/maple-ui.js`.

## Protocol
- `src/bridge/protocol.spec.json` is the source of truth.
- `npm run gen:protocol` regenerates `src/client/IO/UiBridgeProtocol.h`.
- Run it whenever you change the spec; commit the generated header.

## Tests
- `npm test` (Vitest unit), `npm run e2e` (Playwright round-trip vs :8000).
```

- [ ] **Step 3: Run the full build chain to verify**

Run:
```bash
./scripts/build_ui.sh && ./scripts/docker_build_wasm.sh -j 8
```
Expected: both succeed; `web/ui/dist/maple-ui.js` present; engine relinked.

- [ ] **Step 4: Commit**

```bash
git add scripts/build_ui.sh web/ui/README.md docker-compose.yml
git commit -m "build(ui): UI build script + dev/prod integration docs"
```

---

## Definition of done (Phase 0)

- `npm test` green (store + bridge unit tests).
- `npm run e2e` green: overlay mounts, scene reaches DOM, ping/pong round-trips, live HP appears in-game.
- Engine builds with `_maple_bridge_send` exported; no in-engine UI removed yet.
- Dev HMR (`npm run dev` at :5173) runs the real engine via proxy; production page (`:8000`) loads the built overlay.
- Generated `UiBridgeProtocol.h` matches `protocol.spec.json`.

## Notes for subsequent phases (not implemented here)

- Phase 1 (HUD) replaces the in-engine status bar: add `chat`, `menuButton`, `notice` messages; emit chat lines; add `openWindow`/`sendChat` commands; hide `UIStatusbar`.
- Each phase: extend `protocol.spec.json` → regenerate header → add Zod schema + store slice + feature components → add emit/command handling in `UiBridge` → disable the corresponding in-engine `UIElement`.
