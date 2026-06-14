/**
 * Phase 5 Task 4 — Full-flow smoke test covering every DOM UI surface.
 *
 * One comprehensive test drives the complete user journey:
 *   login → world → channel → char → in-game
 *   → Stats / Inventory / Equip / Skills windows (open + close)
 *   → notice toast
 *   → buff bar
 *   → NPC selection dialog (close via button)
 *   → Shop window (exit)
 *
 * Surfaces are asserted to coexist (HUD remains visible while windows/toasts
 * are open). Deterministic state is injected via window.MapleBridge.recv().
 * Canvas pointer interception is bypassed via evaluate() DOM clicks.
 *
 * Screenshots saved to the repo root (not committed):
 *   final-login.png, final-charselect.png, final-ingame.png,
 *   final-window.png, final-dialog.png, final-shop.png
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

  // Wait for HUD to appear (confirms in-game state).
  await expect(page.locator('[data-testid="hud-hp"]')).toBeVisible({
    timeout: 30000,
  });
}

// ---------------------------------------------------------------------------
// Click a HUD menu button by label text. Falls back to native DOM click if
// the canvas overlay intercepts pointer events.
// ---------------------------------------------------------------------------
async function clickMenuButton(page: Page, label: string): Promise<void> {
  const btn = page.getByRole("button", { name: label });
  await expect(btn).toBeVisible({ timeout: 10000 });
  try {
    await btn.click({ timeout: 3000 });
  } catch {
    await page.evaluate((lbl) => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const target = buttons.find((b) => b.textContent?.trim() === lbl);
      target?.click();
    }, label);
  }
}

// ---------------------------------------------------------------------------
// Close the topmost window via its × (aria-label="Close") button.
// Native DOM click bypasses canvas pointer interception.
// ---------------------------------------------------------------------------
async function closeTopWindow(page: Page): Promise<void> {
  const closeBtn = page.locator('button[aria-label="Close"]').last();
  await expect(closeBtn).toBeVisible({ timeout: 5000 });
  await page.evaluate(() => {
    const btns = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        'button[aria-label="Close"]',
      ),
    );
    btns[btns.length - 1]?.click();
  });
}

// ---------------------------------------------------------------------------
// Inject a bridge message via window.MapleBridge.recv().
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

// ===========================================================================
// SMOKE SPEC — full-flow across all DOM UI surfaces
// ===========================================================================

test("Phase 5 smoke: full entry flow + all UI surfaces", async ({ page }) => {
  test.setTimeout(300000);
  resetLoginFlag();

  // ── 1. Entry flow ──────────────────────────────────────────────────────────

  await page.goto("/");

  // Login screen.
  await expect(page.locator('[data-testid="login-account"]')).toBeVisible({
    timeout: 30000,
  });
  await page.screenshot({
    path: "/home/th/Documents/GitHub/maplestory-wasm/final-login.png",
    fullPage: false,
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
  await page.screenshot({
    path: "/home/th/Documents/GitHub/maplestory-wasm/final-charselect.png",
    fullPage: false,
  });

  await page.locator('[data-testid="char-start"]').click();

  // In-game: HUD must appear.
  const hudHp = page.locator('[data-testid="hud-hp"]');
  await expect(hudHp).toBeVisible({ timeout: 30000 });

  // Wait for the map to load (~12 s for LazyFS world streaming).
  await page.waitForTimeout(13000);
  await page.screenshot({
    path: "/home/th/Documents/GitHub/maplestory-wasm/final-ingame.png",
    fullPage: false,
  });

  // HUD gauges must show real stat values.
  await expect(hudHp).toContainText(/\d+ \/ \d+/);
  await expect(page.locator('[data-testid="hud-mp"]')).toContainText(
    /\d+ \/ \d+/,
  );

  // ── 2. Stats window ─────────────────────────────────────────────────────────

  await clickMenuButton(page, "Stats");
  const strVal = page.locator('[data-testid="stat-str"]');
  await expect(strVal).toBeVisible({ timeout: 10000 });
  await expect(strVal).toContainText(/\d+/);
  // HUD coexists while Stats is open.
  await expect(hudHp).toBeVisible();

  await page.screenshot({
    path: "/home/th/Documents/GitHub/maplestory-wasm/final-window.png",
    fullPage: false,
  });

  await closeTopWindow(page);
  await expect(strVal).not.toBeVisible({ timeout: 5000 });

  // ── 3. Inventory window ─────────────────────────────────────────────────────

  await clickMenuButton(page, "Inventory");
  const invWindow = page.locator('[data-testid="inventory-window"]');
  await expect(invWindow).toBeVisible({ timeout: 10000 });
  await expect(hudHp).toBeVisible();
  await closeTopWindow(page);
  await expect(invWindow).not.toBeVisible({ timeout: 5000 });

  // ── 4. Equipment window ─────────────────────────────────────────────────────

  await clickMenuButton(page, "Equip");
  const equipWindow = page.locator('[data-testid="equipment-window"]');
  await expect(equipWindow).toBeVisible({ timeout: 10000 });
  await expect(hudHp).toBeVisible();
  await closeTopWindow(page);
  await expect(equipWindow).not.toBeVisible({ timeout: 5000 });

  // ── 5. Skills window ────────────────────────────────────────────────────────

  await clickMenuButton(page, "Skills");
  const skillsWindow = page.locator('[data-testid="skills-window"]');
  await expect(skillsWindow).toBeVisible({ timeout: 10000 });
  await expect(hudHp).toBeVisible();
  await closeTopWindow(page);
  await expect(skillsWindow).not.toBeVisible({ timeout: 5000 });

  // ── 6. Notice toast ─────────────────────────────────────────────────────────

  await injectBridge(page, {
    v: 1,
    t: "notice",
    json: JSON.stringify({ text: "Welcome to the world!", ntype: "system" }),
  });

  const toast = page.locator('[data-testid="toast"]').first();
  await expect(toast).toBeVisible({ timeout: 5000 });
  await expect(toast).toContainText("Welcome to the world!");
  // HUD still present while toast is shown.
  await expect(hudHp).toBeVisible();

  // ── 7. Buff bar ─────────────────────────────────────────────────────────────

  await injectBridge(page, {
    v: 1,
    t: "buffs",
    json: JSON.stringify([{ skillid: 1001003, duration: 120000 }]),
  });

  const buffBar = page.locator('[data-testid="buff-bar"]');
  await expect(buffBar).toBeVisible({ timeout: 5000 });
  const buffIcon = page.locator('[data-testid="buff-icon"]').first();
  await expect(buffIcon).toBeVisible();
  // HUD still present.
  await expect(hudHp).toBeVisible();

  // ── 8. NPC selection dialog ──────────────────────────────────────────────────

  await injectBridge(page, {
    v: 1,
    t: "npcDialog",
    json: JSON.stringify({
      active: true,
      npcid: 0,
      mode: "selection",
      text: "What do you need?",
      selections: [
        { idx: 0, label: "Shop" },
        { idx: 1, label: "Quests" },
      ],
    }),
  });

  const npcDialog = page.locator('[data-testid="npc-dialog"]');
  await expect(npcDialog).toBeVisible({ timeout: 5000 });

  const shopSelBtn = page.locator('[data-testid="npc-select-0"]');
  const questsSelBtn = page.locator('[data-testid="npc-select-1"]');
  await expect(shopSelBtn).toBeVisible();
  await expect(shopSelBtn).toContainText("Shop");
  await expect(questsSelBtn).toBeVisible();
  await expect(questsSelBtn).toContainText("Quests");

  // HUD coexists with dialog.
  await expect(hudHp).toBeVisible();

  await page.screenshot({
    path: "/home/th/Documents/GitHub/maplestory-wasm/final-dialog.png",
    fullPage: false,
  });

  // Close dialog by clicking the first selection option.
  await shopSelBtn.evaluate((el) => (el as HTMLElement).click());
  // Dialog should dismiss after selection.
  await expect(npcDialog).not.toBeVisible({ timeout: 5000 });

  // ── 9. Shop window ──────────────────────────────────────────────────────────

  await injectBridge(page, {
    v: 1,
    t: "shop",
    json: JSON.stringify({
      active: true,
      npcid: 0,
      items: [
        { slot: 0, itemid: 2000, price: 50, buyable: true },
        { slot: 1, itemid: 2010, price: 120, buyable: true },
      ],
    }),
  });

  const shopWindow = page.locator('[data-testid="shop-window"]');
  await expect(shopWindow).toBeVisible({ timeout: 5000 });

  const buyBtn0 = page.locator('[data-testid="shop-buy-0"]');
  const buyBtn1 = page.locator('[data-testid="shop-buy-1"]');
  await expect(buyBtn0).toBeVisible();
  await expect(buyBtn0).toContainText("Buy");
  await expect(buyBtn1).toBeVisible();
  await expect(buyBtn1).toContainText("Buy");

  // HUD coexists with shop.
  await expect(hudHp).toBeVisible();

  await page.screenshot({
    path: "/home/th/Documents/GitHub/maplestory-wasm/final-shop.png",
    fullPage: false,
  });

  // Exit the shop.
  const exitBtn = page.locator('[data-testid="shop-exit"]');
  await expect(exitBtn).toBeVisible();
  await exitBtn.evaluate((el) => (el as HTMLElement).click());
  await expect(shopWindow).not.toBeVisible({ timeout: 5000 });

  // ── Final: HUD is still alive ───────────────────────────────────────────────
  await expect(hudHp).toBeVisible();
});
