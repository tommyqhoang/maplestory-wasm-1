# Frontend Redesign — Phase 2 (Entry Flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Replace the in-canvas login, world/channel select, and character select with modern DOM screens driven by the MapleBridge. The canvas is hidden during the entry flow; DOM forms drive the existing engine login network actions.

**Architecture:** Strangler pattern. The engine keeps its login network logic; we (a) emit the data the screens need (`loginResult`, `worlds`, `characters`) and the current `scene`, (b) accept commands (`login`, `selectWorld`, `requestCharlist`, `selectChar`, `backToLogin`) that invoke the same engine actions the in-canvas UI used, and (c) suppress the in-canvas login/world/char UI draw. Character avatars are NOT rendered in DOM in this phase (cards show name/level/job/stats); rendered avatars are a later enhancement.

**Tech Stack:** React/TS/Vite (web/ui) reusing Phase 1 design tokens/primitives; C++ engine UiBridge + login handlers. Builds: `./scripts/build_ui.sh`, `./scripts/docker_build_wasm.sh -j 8`. Verify: Vitest + Playwright (reset login flag: `docker exec cosmic-db-1 mysql -uroot cosmic -e "UPDATE accounts SET loggedin=0 WHERE name='wasmteswasmt'"`).

**Reference:** Spec doc; Phase 0/1 plans (bridge API + design system). Data structs in `src/client/Net/Login.h` (`Account`, `World{wid,name,message,channelcount,flag,chloads}`, `CharEntry{cid, StatsEntry stats{name,stats(EnumMap Maplestat),exp,mapid,...}, LookEntry look{female,skin,faceid,hairid,...}}`). Login packets in `src/client/Net/Packets/LoginPackets.h` (`LoginPacket(acc,pass)`, `ServerRequestPacket`, `CharlistRequestPacket(world,channel)`, `PlayerLoginPacket(cid)`). Handlers in `src/client/Net/Handlers/LoginHandlers.{h,cpp}` + `Helpers/LoginParser`. In-canvas UI: `UILogin`, `UIWorldSelect`, `UICharSelect`. Client hardcodes PIC 1010 (see project memory) — the existing select-char path already handles PIC; the `selectChar` command must reuse that exact path.

---

## Scope decision (explicit)
- **In DOM this phase:** login form (account/password, error display), world select (world list + channel grid), character select (cards: name, level, job, key stats; create/delete deferred), "enter game".
- **Deferred:** rendered character avatars in the cards (hard — engine composites them); character creation; cosmetic parity. Cards are text-based for now.
- **Engine still owns:** all login network packets, PIC/PIN, session.

---

## File structure
**Protocol/bridge:**
- `web/ui/src/bridge/protocol.spec.json` + `protocol.ts`: add OUT `loginResult{ok:int, reason:string}`, `worlds{json:string}` (a JSON-encoded array — see note), `characters{json:string}`; IN `login{account:string,password:string}`, `selectWorld{world:int,channel:int}`, `requestCharlist{world:int,channel:int}`, `selectChar{cid:int}`, `backToLogin{}`.
  - NOTE: worlds/characters are variable-length arrays. To avoid encoding arrays in the flat field model, send them as a single `json` string field containing the serialized array; the TS side `JSON.parse`es it and validates with a Zod array schema. (Document this pattern; reused for other list messages later.)
- `MapleBridge.ts`: route loginResult/worlds/characters into store; helpers login/selectWorld/requestCharlist/selectChar/backToLogin.
- regen `UiBridgeProtocol.h`.

**Store:** `web/ui/src/store/store.ts` — add `loginResult`, `worlds: WorldInfo[]`, `characters: CharInfo[]` + setters. Define `WorldInfo`/`CharInfo` types.

**Engine:**
- `src/client/IO/UiBridge.{h,cpp}`: `emit_login_result(ok, reason)`, `emit_worlds(const std::vector<World>&)`, `emit_characters(const std::vector<CharEntry>&)` (serialize to JSON arrays via nlohmann). Commands: `login`→`LoginPacket(acc,pass).dispatch()`; `selectWorld`→store world/channel + `CharlistRequestPacket`? (match in-canvas flow — world select then charlist request); `requestCharlist`→`CharlistRequestPacket(world,channel).dispatch()`; `selectChar`→reuse UICharSelect's select path (PIC). `backToLogin`→relog/return.
- Hook login handlers to emit: after login success → `emit_login_result(1,"")` + request server list / emit worlds; on login fail → `emit_login_result(0, reason)`; `ServerlistHandler`/world data → `emit_worlds`; `CharlistHandler` → `emit_characters`. Read `LoginHandlers.cpp` to find exact points and the data containers.
- Suppress in-canvas entry UI draw on WASM: `UILogin`, `UIWorldSelect`, `UICharSelect` `draw()` early-return under `#ifdef MS_PLATFORM_WASM` (keep logic/objects alive so the network flow still works). Emit `scene` transitions ("login"/"worldselect"/"charselect") at the right points (extend the existing scene emits).

**DOM features:**
- `web/ui/src/features/login/Login.tsx` — account/password form, submit → `bridge.login`; show `loginResult.reason` on error.
- `web/ui/src/features/worldselect/WorldSelect.tsx` — world list + channel grid from store.worlds; select → `bridge.selectWorld`/`requestCharlist`.
- `web/ui/src/features/charselect/CharSelect.tsx` — cards from store.characters; select + "Start" → `bridge.selectChar`.
- A full-screen backdrop (so the canvas/WZ login bg is covered) using design tokens — a clean modern entry background.
- `web/ui/src/app/App.tsx` — route by `scene`: login→`<Login/>`, worldselect→`<WorldSelect/>`, charselect→`<CharSelect/>`, ingame→`<Hud/>`. Hide the canvas (CSS) for non-ingame scenes.

---

## Tasks (each: implement → test → commit; full TDD on bridge/store; e2e at the end)
1. **Bridge+store protocol** (TS, TDD): add the messages, the `json`-string list pattern with Zod array schemas, store slices, helpers, regen header, unit tests. 
2. **Engine emit + commands + handler hooks + scene transitions** (opus): emit login_result/worlds/characters, handle the 5 commands by reusing existing login packets/paths, hook LoginHandlers, suppress in-canvas entry UI draw. Build engine. 
3. **DOM Login + WorldSelect + CharSelect + backdrop + App routing** (reuse design system): build the three screens + full-screen entry backdrop; route by scene; hide canvas off-game. Build UI. 
4. **E2E**: Playwright — DOM login form submit (wasmteswasmt/test1234) → world appears → select → characters appear → select → in-game HUD shows. Assert each DOM screen renders and the flow completes. Capture screenshots for review. Commit.

Each task gets spec + code-quality review (subagent-driven). Detailed per-step code is specified at dispatch time, mirroring Phase 0/1 plans, since exact engine hook points must be confirmed against `LoginHandlers.cpp` during Task 2.

---

## Definition of done (Phase 2)
- Login, world/channel select, and character select are modern DOM screens; the in-canvas versions are suppressed; the canvas is hidden until in-game.
- Full flow works end-to-end against the live server (login→world→char→in-game), verified by Playwright, reusing the Phase 1 HUD in-game.
- Vitest green; engine builds; lint clean.
- Known deferral documented: character cards are text (no rendered avatars), no create/delete yet.
