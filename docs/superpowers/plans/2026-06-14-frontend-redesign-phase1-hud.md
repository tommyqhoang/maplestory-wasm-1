# Frontend Redesign — Phase 1 (HUD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Replace the in-canvas status bar + chat with a modern, readable React DOM HUD (HP/MP/EXP gauges, level, name, job, menu buttons, chat), driven by the MapleBridge. Establish the reusable design-system primitives that Phases 2–5 build on.

**Architecture:** Extend the bridge with `character`/`chat` state events and `openWindow`/`sendChat` commands. The in-engine `UIStatusbar` stops drawing (visual suppression) but stays alive so existing chat-routing/menu plumbing keeps working; the DOM HUD becomes the only visible HUD. Menu buttons forward to `UI::send_menu` (toggles the still-in-engine windows until Phase 3).

**Tech Stack:** React/TS/Vite (web/ui), Zustand, Zod; C++ engine UiBridge. Builds: `./scripts/build_ui.sh`, `./scripts/docker_build_wasm.sh -j 8`. Verify with Vitest + Playwright (login flow: wasmteswasmt/test1234).

**Reference:** Spec `docs/superpowers/specs/2026-06-14-frontend-redesign-design.md`; Phase 0 plan (bridge API). Engine facts: `CharStats::get_name()/get_jobname()` exist; `UI::send_menu(KeyAction::Id)`; menu actions `KeyAction::CHARSTATS/INVENTORY/EQUIPS/SKILLBOOK`; chat lines flow through `MessagingHandlers.cpp` → `UIStatusbar::send_chatline` → `UIChatbar::send_line(line, LineType)`; `UIStatusbar` is created at `UIStateGame.cpp:86` (`emplace<UIStatusbar>(stats)`). Phase 0 already emits numeric `stats` from `UiBridge::poll_emit()` reading `Stage::get().get_player().get_stats()`.

---

## File structure

**Protocol/bridge (extend, don't rewrite):**
- Modify `web/ui/src/bridge/protocol.spec.json` — add messages: `character`(out: name:string, job:string), `chat`(out: line:string, ctype:int), `openWindow`(in: window:string), `sendChat`(in: text:string).
- Modify `web/ui/src/bridge/protocol.ts` — add Zod schemas + extend InboundMsg/OutboundCmd unions.
- Modify `web/ui/src/bridge/MapleBridge.ts` — route `character`/`chat`; add `openWindow(window)` / `sendChat(text)` helpers.
- Regenerate `src/client/IO/UiBridgeProtocol.h` via `npm run gen:protocol`.

**Store:**
- Modify `web/ui/src/store/store.ts` — add `character {name, job}` and `chat: ChatLine[]` (cap length, e.g. last 200), `addChatLine`, `setCharacter`.

**Design system (new — reused by later phases):**
- Create `web/ui/src/design/tokens.css` — CSS variables (colors, spacing, radius, font, shadow) for the modern-MapleStory theme.
- Create `web/ui/src/design/primitives.tsx` — `Panel`, `Button`, `GaugeBar` (label + fill % + value text), `IconButton`. Keep minimal.

**HUD feature (new):**
- Create `web/ui/src/features/hud/Hud.tsx` — composes StatusBar + Chat.
- Create `web/ui/src/features/hud/StatusBar.tsx` — name/job, level, HP/MP/EXP `GaugeBar`s, menu buttons (Stats/Inventory/Equip/Skills).
- Create `web/ui/src/features/hud/Chat.tsx` — scrollable line log + input (Enter → sendChat).
- Create `web/ui/src/features/hud/hud.css`.
- Modify `web/ui/src/app/App.tsx` — render `<Hud/>` when `scene === "ingame"`; keep probe only behind a dev flag (or remove probe).

**Engine:**
- Modify `src/client/IO/UiBridge.h/.cpp` — add `emit_character`, `emit_chat`; cache name/job in poll_emit; handle `openWindow` (→ `UI::send_menu`) and `sendChat`.
- Modify `src/client/IO/UITypes/UIStatusBar.cpp` — suppress visual draw (early-return in `draw()` when bridge HUD active) while keeping update/chat logic; OR add a static "dom_hud" flag. Keep object alive.
- Find the chat-line display sink (MessagingHandlers / UIChatbar::send_line) and also call `UiBridge::get().emit_chat(line, type)` so DOM receives chat. Find the chat-SEND packet (general chat) used by the chatbar enter callback; `sendChat` command must send the same packet.

---

## Task 1: Extend the bridge protocol (TS + codegen) — TDD

**Files:** modify `protocol.spec.json`, `protocol.ts`, `MapleBridge.ts`, `store.ts`; add bridge unit tests; regenerate header.

- [ ] **Step 1:** Add to `protocol.spec.json` messages array:
```json
{ "type": "character", "dir": "out", "fields": [{ "name": "name", "type": "string" }, { "name": "job", "type": "string" }] },
{ "type": "chat", "dir": "out", "fields": [{ "name": "line", "type": "string" }, { "name": "ctype", "type": "int" }] },
{ "type": "openWindow", "dir": "in", "fields": [{ "name": "window", "type": "string" }] },
{ "type": "sendChat", "dir": "in", "fields": [{ "name": "text", "type": "string" }] }
```

- [ ] **Step 2:** In `protocol.ts` add `CharacterMsg`, `ChatMsg` (inbound, add to `InboundMsg` union) and `OpenWindowCmd`, `SendChatCmd` (outbound, add to `OutboundCmd` union). Mirror the existing `v: z.literal(1)` + `t: z.literal(...)` pattern.

- [ ] **Step 3 (TDD):** Add tests to `MapleBridge.test.ts`: recv `character` sets store character; recv `chat` appends a chat line; `openWindow("inventory")` and `sendChat("hi")` produce correct JSON via the transport. Run `npx vitest run` → see new tests fail.

- [ ] **Step 4:** Extend `store.ts` (`character`, `chat[]`, `setCharacter`, `addChatLine` with a cap) and `MapleBridge.ts` (`route` cases for character/chat; `openWindow`/`sendChat` helpers). Run `npx vitest run` → all pass.

- [ ] **Step 5:** `npm run gen:protocol` to regenerate `src/client/IO/UiBridgeProtocol.h`; confirm it now has `MSG_CHARACTER/MSG_CHAT/MSG_OPENWINDOW/MSG_SENDCHAT`.

- [ ] **Step 6:** `npm run build` + `npm run lint` pass. Commit.

---

## Task 2: Engine bridge — emit character/chat, handle openWindow/sendChat

**Files:** modify `src/client/IO/UiBridge.h/.cpp`; the chat display sink; `UIStatusBar.cpp` (suppress draw).

- [ ] **Step 1:** `UiBridge.h`: add `void emit_character(const std::string& name, const std::string& job);`, `void emit_chat(const std::string& line, int ctype);`, and cache fields `std::string name_, job_;`.

- [ ] **Step 2:** `UiBridge.cpp`: implement `emit_character` (JSON v/t/name/job) and `emit_chat` (v/t/line/ctype). In `poll_emit()`, after stats, read `st.get_name()` / `st.get_jobname()`; if changed, `emit_character`.

- [ ] **Step 3:** `handle_command`: add `MSG_OPENWINDOW` → map `window` string to `KeyAction::Id` (stats→CHARSTATS, inventory→INVENTORY, equips→EQUIPS, skills→SKILLBOOK) and call `UI::get().send_menu(action)`. Add `MSG_SENDCHAT` → send a general chat packet with `text`. Find how the in-engine chatbar sends chat (grep for the chat packet, e.g. `GeneralChat`/`ChatPacket` in `Net/Packets/` and `UIChatBar.cpp`'s send path) and replicate it. Include needed headers.

- [ ] **Step 4:** Emit incoming chat to DOM: find where chat lines are shown (grep `send_chatline`/`send_line` callers in `Net/Handlers/MessagingHandlers.cpp` and `UIStateGame.cpp`). At that sink, also call `UiBridge::get().emit_chat(line, static_cast<int>(type))`. (Prefer a single choke point so all chat types are captured.)

- [ ] **Step 5:** Suppress the in-engine HUD visuals: in `UIStatusBar.cpp::draw()`, early-return (draw nothing) so the DOM HUD is the only visible HUD — but keep `update()` and all chat/menu logic intact (the object must stay alive; `UIStateGame` and handlers still call its methods). Guard with a simple compile-time/`#ifdef MS_PLATFORM_WASM` or a static bool `UIStatusbar::dom_hud` defaulting true on WASM. Do NOT remove the element.

- [ ] **Step 6:** Build engine: `./scripts/docker_build_wasm.sh -j 8` → success; `grep -c maple_bridge_send build/JourneyClient.js` ≥ 1. Commit.

---

## Task 3: Design-system primitives + tokens

**Files:** create `web/ui/src/design/tokens.css`, `web/ui/src/design/primitives.tsx`.

- [ ] **Step 1:** `tokens.css`: define CSS variables on `:root` for the modern-MapleStory theme — surface/overlay colors (warm dark panels), accent (maple red/orange), text colors, spacing scale, radius, shadow, font stack, gauge colors (hp red, mp blue, exp gold). Import it in `App.tsx`/`main.tsx`.

- [ ] **Step 2:** `primitives.tsx`: implement `Panel` (rounded translucent panel using tokens), `Button` (accent, hover/active), `IconButton`, and `GaugeBar` (props: label, value, max, color; renders a labeled bar with fill width = value/max and crisp `value / max` text overlay). All use tokens; all `.ui-interactive` where clickable. Keep small and well-typed.

- [ ] **Step 3:** Add a Vitest render test for `GaugeBar` (renders the value/max text and fill width style). `npx vitest run` passes. Commit.

---

## Task 4: HUD feature (StatusBar + Chat) + wire into App

**Files:** create `web/ui/src/features/hud/{Hud,StatusBar,Chat}.tsx`, `hud.css`; modify `App.tsx`.

- [ ] **Step 1:** `StatusBar.tsx`: bottom-anchored bar (Panel). Shows character name + job (from store.character), level (from store.stats.level), and three `GaugeBar`s: HP (stats.hp/maxHp, red), MP (mp/maxMp, blue), EXP (exp shown; for the bar use exp% if available, else show value). Menu buttons row: Stats/Inventory/Equip/Skills → `bridge.openWindow("stats"|"inventory"|"equips"|"skills")`. Use selectors so only changed gauges re-render.

- [ ] **Step 2:** `Chat.tsx`: a Panel with a scrollable list of `store.chat` lines (auto-scroll to bottom on new line) and a text input; Enter sends `bridge.sendChat(text)` and clears. Color lines by ctype minimally.

- [ ] **Step 3:** `Hud.tsx`: compose `<StatusBar/>` + `<Chat/>`. `App.tsx`: render `<Hud/>` only when `scene === "ingame"`; remove/hide the phase0 probe (or keep behind `import.meta.env.DEV`).

- [ ] **Step 4:** `hud.css`: layout (status bar bottom-center, chat bottom-left), using tokens. Ensure `pointer-events` only on interactive widgets.

- [ ] **Step 5:** `npm run build` + `npm run lint` + `npm test` pass. Commit.

---

## Task 5: End-to-end verification

**Files:** add `web/ui/e2e/hud.spec.ts`.

- [ ] **Step 1:** Playwright test: log in (wasmteswasmt/test1234) to in-game; assert the DOM HUD is visible — `HP 50 / 50` text present in a `[data-testid="hud-hp"]` (add testids to gauges), level shown, name shown; the in-engine status bar is not visible (the DOM one is). Click the Inventory menu button and assert no crash (the in-engine inventory window opens on canvas — acceptable until Phase 3). Type in chat input + Enter and assert input clears.
- [ ] **Step 2:** Build UI (`./scripts/build_ui.sh`) so the live stack serves it; run `npx playwright test e2e/hud.spec.ts` → pass. Commit.

---

## Definition of done (Phase 1)
- DOM HUD visible in-game with readable HP/MP/EXP gauges, level, name, job; in-engine status bar visually suppressed (no double HUD).
- Menu buttons open the (still in-engine) windows via `openWindow` → `send_menu`.
- Incoming chat appears in the DOM chat panel; typing + Enter sends chat to the server.
- Vitest + Playwright green; engine builds; lint clean.
- Design tokens + primitives exist for reuse in Phases 2–5.
