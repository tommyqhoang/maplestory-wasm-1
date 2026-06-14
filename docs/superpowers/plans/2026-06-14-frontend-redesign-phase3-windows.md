# Frontend Redesign — Phase 3 (In-game Windows) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Replace the in-canvas Stats, Inventory, Equipment, and Skills windows with modern DOM windows driven by the MapleBridge, including a reusable **asset-image bridge** so WZ icons (and later avatars) render as DOM `<img>`.

**Architecture:** Strangler pattern, building on Phases 0–2. The menu buttons already send `openWindow` (currently → in-engine windows); we switch them to DOM windows: emit window data over the bridge, render DOM windows, suppress the in-canvas windows. Add a generic asset-image bridge: DOM requests an icon by key; engine resolves the WZ bitmap (reusing existing icon-load code), encodes PNG via the vendored `stb_image_write`, base64-encodes, emits an `asset` message; DOM caches and shows it.

**Tech Stack:** React/TS/Vite (web/ui) reusing design system; C++ engine UiBridge + stb_image_write (`src/client/includes/stb/stb_image_write.h`). Builds: `./scripts/build_ui.sh`, `./scripts/docker_build_wasm.sh -j 8`. Verify: Vitest + Playwright.

**Reference:** Spec; Phase 0–2 plans. Engine: in-canvas windows `src/client/IO/UITypes/UIStatsInfo.cpp` (stats), `UIItemInventory.cpp`/`UIInventory*` (inventory), `UIEquipInventory.cpp` (equip), `UISkillBook.cpp` (skills) — READ these to find the data sources and how icons are loaded. Player data via `Stage::get().get_player()`: `.get_stats()` (CharStats), `.get_inventory()` (Inventory), `.get_skills()`. Menu open path: `UI::send_menu(KeyAction::CHARSTATS/INVENTORY/EQUIPS/SKILLBOOK)`. Item icon loading: find where the in-canvas inventory resolves an item id to its icon bitmap (likely `ItemData`/`nl::nx::item`); reuse it.

---

## Scope decision (explicit)
- **In DOM this phase:** Stats window (full primary/secondary stats + AP allocation), Inventory (tabs Equip/Use/Setup/Etc/Cash; item slots with icon + count; basic actions: equip-on-double-click for equips, use-on-double-click for consumables — only if low-risk; otherwise display + tooltip), Equipment window (equipped slots with icons), Skills window (skill list with icon/level). Asset-image bridge for icons.
- **Deferred:** drag-and-drop item moving between slots (complex), item splitting/dropping, advanced context menus. Keep actions minimal and safe; display + the most common action (equip/use) if reliably reusable from engine paths.
- **Engine still owns:** inventory mutation packets, AP packets, skill packets — DOM commands reuse existing engine paths.

---

## Task 1 — Asset-image bridge (engine + bridge + DOM cache)
- Protocol: IN `requestAsset{key:string}`; OUT `asset{key:string, dataUrl:string}` (dataUrl = `data:image/png;base64,...`, empty string if not found).
- Engine `UiBridge`: `handle requestAsset` → resolve the WZ bitmap for `key` (key scheme: e.g. `"item/<id>"`, `"skill/<id>"`, `"equip/<id>"`; map to the existing icon-load code), get its BGRA pixels+dims, convert to RGBA, encode PNG with `stbi_write_png_to_func` (write to a std::string buffer), base64-encode, `emit_asset(key, "data:image/png;base64,"+b64)`. Cache resolved keys engine-side to avoid recompute. If not found, emit empty dataUrl.
- DOM: `web/ui/src/bridge/assets.ts` — `useAsset(key)` hook + a Zustand `assets: Record<string,string>` cache; `requestAsset(key)` once per missing key; an `<AssetImage assetKey=... />` component that requests on mount and renders the cached `<img>` (placeholder until loaded). Route `asset` message → cache.
- TDD: bridge unit test for `asset` routing + assets cache; a Vitest test for the assets store.
- Build engine + UI. Commit.

## Task 2 — Stats window (DOM, no icons)
- Protocol: OUT `statsdetail{json:string}` (full stats: str/dex/int/luk, ap, hp/maxHp/mp/maxMp, secondary stats the in-canvas window shows — read UIStatsInfo for the list); IN `allocateAp{stat:string}` (str/dex/int/luk).
- Engine: emit statsdetail on change (extend poll_emit or a dedicated emit when stats window data changes); `allocateAp` → reuse the engine AP-allocation packet the in-canvas window sends (find it in UIStatsInfo). Suppress UIStatsInfo draw under WASM (keep alive).
- DOM `features/stats/StatsWindow.tsx`: a draggable `Window` primitive (add a `Window` to design/primitives if not present: title bar + close). Show stats; show `+` buttons next to STR/DEX/INT/LUK when ap>0 → `allocateAp`. Open when store flag set.
- Window open/close: the `openWindow("stats")` command currently opens the in-engine window; switch so the DOM tracks open windows. Add store `openWindows: Set<string>` toggled by an OUT `windowToggle{window,open}` emitted when the engine receives openWindow, OR simpler: handle openWindow on the DOM side too — when a menu button is clicked, the HUD already calls bridge.openWindow; ALSO toggle a DOM store flag. Decide a clean single source of truth (recommend: DOM owns window open-state; menu buttons toggle DOM windows directly and do NOT need the engine for stats/inventory/skills/equip display since data is emitted continuously/on-open. Keep `openWindow` command only for windows still served in-engine, if any.)
- TDD + e2e. Commit.

## Task 3 — Inventory + Equipment windows (DOM, with icons)
- Protocol: OUT `inventory{json:string}` (per tab: array of {slot, itemid, count}); `equipment{json:string}` (array of {slot, itemid}); emit on change/open. IN (optional, only if safely reusable) `equipItem{slot}`, `useItem{slot}`.
- Engine: emit inventory/equipment from `Stage::get().get_player().get_inventory()`; suppress in-canvas inventory/equip windows. For actions, reuse engine paths only if low-risk; else display-only this phase.
- DOM `features/inventory/InventoryWindow.tsx` (tabs + slot grid using `AssetImage` keyed by `item/<itemid>` + count badge) and `features/equipment/EquipmentWindow.tsx` (equip slots layout with `AssetImage`). Tooltips show item id/name if available.
- e2e: open inventory in-game, assert grid + at least the window renders; icons load (assert an `<img>` with a data: src appears). Commit.

## Task 4 — Skills window (DOM, with icons)
- Protocol: OUT `skills{json:string}` (array of {skillid, level, masterlevel}).
- Engine: emit from `get_skills()`; suppress UISkillBook draw.
- DOM `features/skills/SkillsWindow.tsx`: list/grid of skills with `AssetImage` keyed by `skill/<skillid>`, level shown.
- e2e: open skills, assert renders + an icon img. Commit.

## Task 5 — Integration pass + e2e
- Wire all four windows to the HUD menu buttons (Stats/Inventory/Equip/Skills toggle the DOM windows). Ensure windows are draggable, closeable, don't overlap badly, use the design system.
- Full e2e: in-game, open each window via its menu button, assert each DOM window appears with content (and icons where applicable), close works. Screenshots for review. Commit.

---

## Definition of done (Phase 3)
- Stats/Inventory/Equipment/Skills are DOM windows opened from the HUD menu buttons; in-canvas versions suppressed.
- WZ icons render in inventory/equip/skills via the asset-image bridge; stats AP allocation works.
- Vitest + Playwright green; engine builds; lint clean.
- Documented deferrals: drag-and-drop item moving, splitting/dropping, advanced context menus.
