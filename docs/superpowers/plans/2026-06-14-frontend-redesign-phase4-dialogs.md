# Frontend Redesign — Phase 4 (Dialogs & Shops) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Replace the in-canvas NPC dialogue and shop UIs with modern DOM modals driven by the MapleBridge. (Quest log and storage deferred to Phase 5/later.)

**Architecture:** Strangler pattern, building on Phases 0–3 (bridge, design system, asset-image bridge). Engine emits dialogue/shop state; DOM renders the modal/window; commands reuse the existing engine response packets; in-canvas `UINpcTalk`/`UIShop` draws suppressed.

**Tech Stack:** React/TS/Vite (web/ui) reusing design system + `AssetImage`; C++ engine UiBridge. Builds: `./scripts/build_ui.sh`, `./scripts/docker_build_wasm.sh -j 8`. Verify: Vitest + Playwright.

**Reference:** Engine NPC dialog UI `src/client/IO/UITypes/UINpcTalk.{h,cpp}` (`DialogueMode` enum = the dialog variants: ok/next/nextprev/yesno/accept-decline/text-entry/selection — READ for the exact set + how it parses selections + how it sends responses). Response packets `src/client/Net/Packets/NpcInteractionPackets.h`: `NpcTalkMorePacket(lastmsg, response)` with helpers (`response==-1` close, `0` prev, `1` next/ok; `selection(lastmsg, idx)` for menu; string ctor for text entry), `NpcShopActionPacket` (buy/sell/recharge/exit — read its ctors). Handlers `src/client/Net/Handlers/NpcInteractionHandlers.{h,cpp}` (`NpcDialogueHandler`, `OpenNpcShopHandler`). Shop UI `src/client/IO/UITypes/UIShop.{h,cpp}`. Talk trigger: the player talks to an NPC (engine sends `TalkToNPCPacket`) — the dialog then arrives via `NpcDialogueHandler`.

---

## Scope decision (explicit)
- **In DOM this phase:** NPC dialogue modal (all dialogue modes: plain/ok, next, next+prev, yes/no, accept/decline, text input, selection menu) with the NPC name/speaker; NPC shop (item list with icons + price, player inventory sell side, buy/sell/exit). 
- **Deferred:** quest log UI, storage/bank, trade, gachapon, and other NPC sub-UIs (Phase 5/later). Keep the dialogue modes that the engine `DialogueMode` enum defines; if some are rare/complex (e.g. styled item selection), render a sensible fallback.
- **Engine still owns:** all NPC/shop packets; DOM commands reuse them exactly.

---

## Task 1 — NPC dialogue modal (bridge + engine + DOM)
- Protocol: OUT `npcDialog{json:string}` payload `{ active:bool, npcid:int, mode:string, text:string, selections?: [{idx,label}] }` (mode = a stable string per DialogueMode; selections only for the menu mode). When the dialog closes, emit `{active:false}`. IN `npcRespond{action:string, selection?:int, text?:string}` where action ∈ {next, prev, ok, yes, no, accept, decline, select, submitText, close}.
- Engine: in `NpcDialogueHandler` (and wherever UINpcTalk.change_text is driven), build the payload and `emit_npc_dialog(...)`; emit `{active:false}` when the dialog ends/closes. `handle_command npcRespond`: map action+selection/text to the correct `NpcTalkMorePacket` variant (reuse UINpcTalk's own send logic if cleaner — it knows `lastmsg`/mode; consider adding a public method on UINpcTalk like `respond(action, selection, text)` that runs the same path as its buttons, and call it from the bridge so `lastmsg`/mode bookkeeping stays correct). Suppress `UINpcTalk::draw()` under `#ifdef MS_PLATFORM_WASM` (keep logic alive — it tracks dialog state/lastmsg).
- DOM `web/ui/src/features/npc/NpcDialog.tsx`: a centered modal (design system) shown when `npcDialog.active`. Renders the (formatted) text; buttons depend on mode: ok→[OK], next→[Next], nextprev→[Prev][Next], yesno→[Yes][No], acceptdecline→[Accept][Decline], textentry→[input + OK], selection→list of selection buttons. Each → `bridge.npcRespond(...)`. Esc/close → `npcRespond("close")`. Store `npcDialog` slice + route.
- TDD (bridge/store) + the DOM modal render test. Build engine + UI. Commit.

## Task 2 — NPC shop (bridge + engine + DOM)
- Protocol: OUT `shop{json:string}` payload `{ active:bool, npcid:int, items:[{slot,itemid,price,buyable:bool}] }` (active:false on close). IN `shopAction{action:string, slot?:int, itemid?:int, quantity?:int}` action ∈ {buy, sell, exit}.
- Engine: in `OpenNpcShopHandler` build + `emit_shop(...)`; emit `{active:false}` on shop close. `handle_command shopAction`: map to `NpcShopActionPacket` (buy/sell/exit) reusing UIShop's logic where possible. Suppress `UIShop::draw()` under WASM.
- DOM `web/ui/src/features/shop/Shop.tsx`: a window (design system) shown when `shop.active`: left = shop items (AssetImage `item/<id>` or `equip/<id>` + price + Buy button); right = the player's sellable inventory (reuse store.inventory) with Sell; Exit button → `shopAction("exit")`. Buy/Sell quantity defaults to 1 (a simple qty input optional). Store `shop` slice + route.
- TDD + render test. Build engine + UI. Commit.

## Task 3 — E2E + screenshots
- Playwright: in-game, walk/trigger an NPC conversation in the starting map. Driving NPC talk in-canvas is hard; acceptable approaches: (a) move the character to a known NPC and press the NPC-talk key (the engine's talk key) / click the NPC; OR (b) if reliably triggering a live NPC is flaky, at minimum verify the DOM modal renders by injecting a dialog via `window.MapleBridge.recv(JSON.stringify({v:1,t:"npcDialog",json:JSON.stringify({active:true,npcid:0,mode:"ok",text:"Hello"})}))` and asserting the modal + OK button appear and a click sends `npcRespond`. Prefer a real NPC if achievable; always include the injection-based DOM assertion so the modal is verified. Capture screenshots of the dialog modal (and shop if triggerable). Commit.

---

## Definition of done (Phase 4)
- NPC dialogue and shop render as DOM modals/windows; in-canvas versions suppressed; responses reuse the engine packets.
- All dialogue modes have appropriate DOM controls; shop buy/sell/exit work via the existing packets.
- Vitest + Playwright green (incl. the DOM-modal injection assertion); engine builds; lint clean.
- Documented deferrals: quest log, storage, trade, other NPC sub-UIs.
