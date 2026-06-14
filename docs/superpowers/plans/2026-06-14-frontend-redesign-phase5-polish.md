# Frontend Redesign — Phase 5 (Polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Final polish pass that makes the DOM UI cohesive and professional: fix the known rough edges, add buff icons + notification toasts, add item/skill tooltips, a motion pass, a design-system consistency audit, and resize responsiveness. Then a holistic review + full-flow smoke test.

**Architecture:** Builds on Phases 0–4 (bridge, design system, asset-image bridge, all DOM surfaces). Mostly DOM/CSS work + two small new bridge messages (buffs, notice).

**Tech Stack:** React/TS/Vite (web/ui) + design system + `AssetImage`; minimal engine emits. Builds: `./scripts/build_ui.sh`, `./scripts/docker_build_wasm.sh -j 8`. Verify: Vitest + Playwright.

**Reference:** Spec; Phase 0–4 plans/memory. Engine buff source `src/client/IO/UITypes/UIBuffList.{h,cpp}` (active buffs = skill/buff ids + remaining time — READ; player buffs likely on `Stage::get().get_player()` or a buff manager). System messages/notices `src/client/IO/UITypes/UINotice.{h,cpp}` and `src/client/IO/Messages.*` / `MessagingHandlers.cpp`. Known rough edges from earlier phases: login title "watermark" duplication; HUD character name not visibly rendering; HUD status-bar/chat layout a bit merged.

---

## Scope decision (explicit)
- **In this phase:** fix login watermark; fix HUD char name + tidy status-bar/chat layout; item & skill tooltips (name/desc if available, else id); buff/debuff icon strip (active buffs with icons via asset bridge); notification/system-message toasts; a motion pass (subtle transitions on windows/modals/toasts); design-token consistency audit across all features; window resize responsiveness (clamp windows to viewport; HUD/entry scale sensibly).
- **Deferred (documented limitations, not in scope):** rendered character avatars (need an engine character-composite-to-image; large), quest log UI, storage/bank, trade. Note these clearly in the final report as remaining work.

---

## Task 1 — Fix known rough edges + design audit
- Login: remove/​fix the duplicate "MapleStory" title watermark in `features/login/Login.tsx` (and any leftover canvas/WZ bleed-through — ensure the entry backdrop fully covers; the canvas should be `visibility:hidden` off-game already). Make the login card visually polished (spacing, focus states).
- HUD: ensure the character `name` renders visibly in `features/hud/StatusBar.tsx` (it's in `store.character.name` — fix contrast/position so it shows); tidy the status-bar + chat layout so they read as distinct, well-aligned panels (no awkward overlap). 
- Design audit: skim every `features/*` + `design/*`; ensure consistent use of tokens (colors/spacing/radius/shadow), consistent Window/Panel/Button usage, consistent font sizes. Fix inconsistencies. Keep changes focused on consistency, not redesign.
- Build UI; `npm test`/`build`/`lint` green. Commit.

## Task 2 — Item/skill tooltips + motion pass
- Tooltips: add a lightweight `Tooltip` primitive (if not present) and wire it on inventory/equip/shop item cells and skill cells — show the item/skill name if the engine can supply it, else `#<id>`. (If item names require a new bridge field, add `name` to the inventory/shop item payloads by resolving via the engine ItemData name lookup — optional; if costly, show id-based tooltips.)
- Motion: add subtle, fast CSS transitions/animations — window open/close fade+scale, modal fade, toast slide-in, button hover. Respect `prefers-reduced-motion`. Keep it tasteful (short durations).
- Build UI; tests/lint green. Commit.

## Task 3 — Buff icons + notification toasts (bridge + engine + DOM)
- Protocol: OUT `buffs{json:string}` payload array `[{skillid:int, duration:int}]`; OUT `notice{json:string}` payload `{text:string, ntype:string}` (a transient system/notification message).
- Engine: emit active buffs from the player's buff state (read UIBuffList/player buffs) on change; emit notices where the engine shows a system message (hook the same point that drives UINotice/Messages — find a single choke point). Suppress in-canvas UIBuffList draw under WASM if it would double-render (the DOM shows buffs). Don't break the in-canvas notice if it's also used elsewhere — prefer additive emit.
- DOM: `features/buffs/BuffBar.tsx` — a top/side strip of active buff icons (`AssetImage skill/<skillid>`) with a remaining-time indicator; mounted in Hud when in-game. `features/notifications/Toasts.tsx` — a stack of auto-dismissing toasts fed by a store `notices` queue (route `notice` → push; auto-remove after a few seconds). Store slices + routes. TDD on the bridge routing.
- Build engine + UI; tests/lint green. Commit.

## Task 4 — Final holistic review + smoke e2e + screenshots
- Playwright smoke: full flow login→world→char→in-game; open each window (stats/inventory/equip/skills) and close; inject a dialog + shop + a buff + a notice and assert each DOM surface renders. Confirm everything coexists without layout breakage. (Reuse the injection approach for dialog/shop/buff/notice.)
- Capture screenshots of: login, char select, in-game HUD (with map loaded — wait 12s+ for LazyFS), a window open, a dialog, the shop.
- Dispatch a final holistic code reviewer over the whole `frontend-redesign` branch (master..HEAD): verify all phases integrate, no dead code beyond documented deferrals, bridge protocol consistent (spec.json ↔ Zod ↔ generated header), lint/tests green, engine builds.
- Commit any review fixes.

---

## Definition of done (Phase 5 / initiative)
- Login/HUD rough edges fixed; UI cohesive under the design system; tooltips + motion + responsiveness in place; buff icons + notification toasts working.
- Full-flow smoke e2e green; all DOM surfaces render and coexist; engine builds; lint/tests green.
- Final review passed; remaining limitations (avatars, quest log, storage, trade) clearly documented.
- The web client is professionally playable with a modern DOM UI end-to-end (entry → HUD → windows → dialogs/shop), with the C++ engine rendering only the game world.
