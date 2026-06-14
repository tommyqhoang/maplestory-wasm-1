/**
 * Phase 4 Task 3 — End-to-end verification of the NPC dialogue modal and shop window.
 *
 * Uses injection-based DOM testing: window.MapleBridge.recv() drives the zustand
 * store so the React components render deterministically without a live NPC.
 * Module.ccall is wrapped to record outbound bridge calls for assertion.
 */

import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Reset the test account's login flag so we never hit "already logged in".
// ---------------------------------------------------------------------------
function resetLoginFlag(): void {
  try {
    execSync(
      `docker exec cosmic-db-1 mysql -u root --password="" cosmic ` +
        `-e "UPDATE accounts SET loggedin=0 WHERE name='wasmteswasmt';"`,
      { stdio: "pipe" },
    );
  } catch {
    console.warn("[setup] could not reset login flag — proceeding anyway");
  }
}

// ---------------------------------------------------------------------------
// Full DOM entry flow: login → world select → channel → char select → in-game.
// Mirrors the helper in entry.spec.ts and windows.spec.ts.
// ---------------------------------------------------------------------------
async function loginToIngame(page: Page): Promise<void> {
  await page.goto("/");

  await expect(page.locator('[data-testid="login-account"]')).toBeVisible({
    timeout: 30000,
  });

  await page.locator('[data-testid="login-account"]').fill("wasmteswasmt");
  await page.locator('[data-testid="login-password"]').fill("test1234");
  await page.locator('[data-testid="login-submit"]').click();

  // World select.
  const firstWorldBtn = page.locator('[data-testid^="world-"]').first();
  await expect(firstWorldBtn).toBeVisible({ timeout: 20000 });
  await firstWorldBtn.click();

  // Channel select.
  const firstChannelBtn = page.locator('[data-testid^="channel-"]').first();
  await expect(firstChannelBtn).toBeVisible({ timeout: 10000 });
  await firstChannelBtn.click();

  // Character select.
  const firstCharCard = page.locator('[data-testid^="char-"]').first();
  await expect(firstCharCard).toBeVisible({ timeout: 20000 });
  await firstCharCard.click();
  await page.locator('[data-testid="char-start"]').click();

  // Wait for HUD (confirms in-game state).
  await expect(page.locator('[data-testid="hud-hp"]')).toBeVisible({
    timeout: 30000,
  });
}

// ---------------------------------------------------------------------------
// Inject a bridge message by calling window.MapleBridge.recv() from page context.
// ---------------------------------------------------------------------------
async function injectBridge(page: Page, msg: object): Promise<void> {
  await page.evaluate((m) => {
    (
      window as unknown as {
        MapleBridge: { recv: (json: string) => void };
      }
    ).MapleBridge.recv(JSON.stringify(m));
  }, msg);
}

// ---------------------------------------------------------------------------
// Wrap Module.ccall to record calls; returns recorded-call getter.
// This must be called BEFORE triggering the click so the spy is in place.
// ---------------------------------------------------------------------------
async function installCcallSpy(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      Module?: { ccall?: (...a: unknown[]) => unknown };
      __ccallLog: unknown[][];
    };
    w.__ccallLog = [];
    const mod = w.Module;
    if (mod) {
      const orig = mod.ccall?.bind(mod);
      mod.ccall = (...args: unknown[]) => {
        w.__ccallLog.push(args);
        return orig ? orig(...args) : undefined;
      };
    } else {
      // Engine not ready yet — install a stub that also captures calls.
      (w as unknown as Record<string, unknown>).Module = {
        ccall: (...args: unknown[]) => {
          w.__ccallLog.push(args);
        },
      };
    }
  });
}

// ---------------------------------------------------------------------------
// Retrieve recorded ccall log from the page.
// ---------------------------------------------------------------------------
async function getCcallLog(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => {
    return (window as unknown as { __ccallLog: unknown[][] }).__ccallLog;
  });
}

// ---------------------------------------------------------------------------
// Assert that a maple_bridge_send ccall was recorded matching an action string
// within the JSON payload.  The transport calls:
//   Module.ccall("maple_bridge_send", null, ["string"], [jsonString])
// so args[0]==="maple_bridge_send" and args[3][0] is the JSON string.
// ---------------------------------------------------------------------------
function findBridgeCall(
  log: unknown[][],
  predicate: (parsed: Record<string, unknown>) => boolean,
): boolean {
  for (const args of log) {
    if (args[0] !== "maple_bridge_send") continue;
    const jsonArg = (args[3] as string[])?.[0];
    if (typeof jsonArg !== "string") continue;
    try {
      const parsed = JSON.parse(jsonArg) as Record<string, unknown>;
      if (predicate(parsed)) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

// ===========================================================================
// Test 1: NPC OK dialog — injection, render, click OK, verify ccall
// ===========================================================================
test("NPC ok dialog: renders text + OK button; click records npcRespond ok", async ({
  page,
}) => {
  test.setTimeout(120000);
  resetLoginFlag();

  await loginToIngame(page);

  // Inject an NPC ok dialog.
  await injectBridge(page, {
    v: 1,
    t: "npcDialog",
    json: JSON.stringify({
      active: true,
      npcid: 0,
      mode: "ok",
      text: "Hello adventurer!",
    }),
  });

  // Wait for the modal to appear.
  const modal = page.locator('[data-testid="npc-dialog"]');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Assert dialog text is shown.
  const textEl = page.locator('[data-testid="npc-dialog-text"]');
  await expect(textEl).toBeVisible();
  await expect(textEl).toContainText("Hello adventurer!");

  // Assert OK button is present.
  const okBtn = page.locator('[data-testid="npc-btn-ok"]');
  await expect(okBtn).toBeVisible();

  // Screenshot with dialog visible.
  await page.screenshot({
    path: "/home/th/Documents/GitHub/maplestory-wasm/p4-dialog.png",
  });

  // Install spy before clicking.
  await installCcallSpy(page);

  // Click OK.
  await okBtn.evaluate((el) => (el as HTMLElement).click());

  // Retrieve log and assert a maple_bridge_send with t=npcRespond action=ok.
  const log = await getCcallLog(page);
  const found = findBridgeCall(
    log,
    (p) => p.t === "npcRespond" && p.action === "ok",
  );
  expect(found, "Expected maple_bridge_send(npcRespond,ok) in ccall log").toBe(
    true,
  );
});

// ===========================================================================
// Test 2: NPC selection dialog — renders options; click "Option B" records select 1
// ===========================================================================
test("NPC selection dialog: renders selection buttons; click Option B records select idx 1", async ({
  page,
}) => {
  test.setTimeout(120000);
  resetLoginFlag();

  await loginToIngame(page);

  // Inject a selection dialog.
  await injectBridge(page, {
    v: 1,
    t: "npcDialog",
    json: JSON.stringify({
      active: true,
      npcid: 0,
      mode: "selection",
      text: "What would you like?",
      selections: [
        { idx: 0, label: "Option A" },
        { idx: 1, label: "Option B" },
      ],
    }),
  });

  const modal = page.locator('[data-testid="npc-dialog"]');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Assert both selection buttons are present.
  const btnA = page.locator('[data-testid="npc-select-0"]');
  const btnB = page.locator('[data-testid="npc-select-1"]');
  await expect(btnA).toBeVisible();
  await expect(btnA).toContainText("Option A");
  await expect(btnB).toBeVisible();
  await expect(btnB).toContainText("Option B");

  // Install spy, click Option B.
  await installCcallSpy(page);
  await btnB.evaluate((el) => (el as HTMLElement).click());

  const log = await getCcallLog(page);
  const found = findBridgeCall(
    log,
    (p) => p.t === "npcRespond" && p.action === "select" && p.selection === 1,
  );
  expect(
    found,
    "Expected maple_bridge_send(npcRespond,select,1) in ccall log",
  ).toBe(true);
});

// ===========================================================================
// Test 3: Shop window — renders Buy; click Buy records buy; Exit records exit
// ===========================================================================
test("Shop window: renders with Buy button and Exit; clicks record shopAction calls", async ({
  page,
}) => {
  test.setTimeout(120000);
  resetLoginFlag();

  await loginToIngame(page);

  // Inject a shop payload.
  await injectBridge(page, {
    v: 1,
    t: "shop",
    json: JSON.stringify({
      active: true,
      npcid: 0,
      items: [{ slot: 0, itemid: 2000, price: 50, buyable: true }],
    }),
  });

  const shopWindow = page.locator('[data-testid="shop-window"]');
  await expect(shopWindow).toBeVisible({ timeout: 5000 });

  // Assert Buy button for slot 0 is visible.
  const buyBtn = page.locator('[data-testid="shop-buy-0"]');
  await expect(buyBtn).toBeVisible();
  await expect(buyBtn).toContainText("Buy");

  // Screenshot with shop visible.
  await page.screenshot({
    path: "/home/th/Documents/GitHub/maplestory-wasm/p4-shop.png",
  });

  // Install spy, click Buy.
  await installCcallSpy(page);
  await buyBtn.evaluate((el) => (el as HTMLElement).click());

  const buyLog = await getCcallLog(page);
  const buyFound = findBridgeCall(
    buyLog,
    (p) => p.t === "shopAction" && p.action === "buy",
  );
  expect(
    buyFound,
    "Expected maple_bridge_send(shopAction,buy) in ccall log",
  ).toBe(true);

  // Reset spy log, then click Exit.
  await page.evaluate(() => {
    (window as unknown as { __ccallLog: unknown[][] }).__ccallLog = [];
  });

  const exitBtn = page.locator('[data-testid="shop-exit"]');
  await expect(exitBtn).toBeVisible();
  await exitBtn.evaluate((el) => (el as HTMLElement).click());

  const exitLog = await getCcallLog(page);
  const exitFound = findBridgeCall(
    exitLog,
    (p) => p.t === "shopAction" && p.action === "exit",
  );
  expect(
    exitFound,
    "Expected maple_bridge_send(shopAction,exit) in ccall log",
  ).toBe(true);
});
