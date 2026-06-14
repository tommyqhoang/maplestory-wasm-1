/**
 * Phase 3 Task 5 — End-to-end verification of the four in-game DOM windows:
 * Stats, Inventory, Equipment, Skills.
 *
 * Each window is opened via its HUD menu button, asserted to render correctly,
 * then closed via its × button and asserted gone.
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
// Mirrors the helper in entry.spec.ts.
// ---------------------------------------------------------------------------
async function loginToIngame(page: Page): Promise<void> {
  await page.goto("/");

  // DOM login form must appear (proves DOM entry flow is active).
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
// Helper: click a HUD menu button by its label text, with fallback evaluate().
// The canvas overlay sometimes intercepts pointer events; if the role click
// is blocked, we fall back to a native DOM click via evaluate().
// ---------------------------------------------------------------------------
async function clickMenuButton(page: Page, label: string): Promise<void> {
  const btn = page.getByRole("button", { name: label });
  await expect(btn).toBeVisible({ timeout: 10000 });
  try {
    await btn.click({ timeout: 3000 });
  } catch {
    // Fallback: native DOM click bypasses Playwright actionability checks.
    await page.evaluate((lbl) => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const target = buttons.find((b) => b.textContent?.trim() === lbl);
      target?.click();
    }, label);
  }
}

// ---------------------------------------------------------------------------
// Helper: close the topmost window via its × (aria-label="Close") button.
// Uses native DOM click via evaluate() to bypass canvas pointer interception,
// matching the pattern established in roundtrip.spec.ts.
// ---------------------------------------------------------------------------
async function closeWindow(page: Page): Promise<void> {
  const closeBtn = page.locator('button[aria-label="Close"]').last();
  await expect(closeBtn).toBeVisible({ timeout: 5000 });
  // Native click bypasses Playwright actionability checks and canvas overlay.
  await page.evaluate(() => {
    const btns = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        'button[aria-label="Close"]',
      ),
    );
    btns[btns.length - 1]?.click();
  });
}

// ===========================================================================
// Tests
// ===========================================================================

test.describe("In-game DOM windows", () => {
  test.setTimeout(180000);

  test.beforeEach(async () => {
    resetLoginFlag();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Stats window
  // ─────────────────────────────────────────────────────────────────────────
  test("Stats window opens, shows stat values, and closes", async ({
    page,
  }) => {
    await loginToIngame(page);

    // Open Stats window.
    await clickMenuButton(page, "Stats");

    // The Stats window has no single container testid, but its stat rows do.
    // Assert STR and Level appear with numeric values — proves engine data arrived.
    const strVal = page.locator('[data-testid="stat-str"]');
    await expect(strVal).toBeVisible({ timeout: 10000 });
    await expect(strVal).toContainText(/\d+/);

    const levelVal = page.locator('[data-testid="stat-level"]');
    await expect(levelVal).toBeVisible({ timeout: 5000 });
    await expect(levelVal).toContainText(/\d+/);

    // HP stat row (format "N / M").
    const hpVal = page.locator('[data-testid="stat-hp"]');
    await expect(hpVal).toBeVisible({ timeout: 5000 });
    await expect(hpVal).toContainText(/\d+ \/ \d+/);

    // Screenshot with Stats window open.
    await page.screenshot({
      path: "/home/th/Documents/GitHub/maplestory-wasm/p3-stats.png",
      fullPage: false,
    });

    // Close via × button; Stats rows must disappear.
    await closeWindow(page);
    await expect(strVal).not.toBeVisible({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Inventory window
  // ─────────────────────────────────────────────────────────────────────────
  test("Inventory window opens, shows 5 tabs, tab switch works, and closes", async ({
    page,
  }) => {
    await loginToIngame(page);

    // Open Inventory window.
    await clickMenuButton(page, "Inventory");

    const invWindow = page.locator('[data-testid="inventory-window"]');
    await expect(invWindow).toBeVisible({ timeout: 10000 });

    // All 5 tabs must exist.
    const tabKeys = ["equip", "use", "setup", "etc", "cash"];
    for (const key of tabKeys) {
      await expect(
        page.locator(`[data-testid="inventory-tab-${key}"]`),
      ).toBeVisible({ timeout: 5000 });
    }

    // Click the "Use" tab — must not crash.
    await page.locator('[data-testid="inventory-tab-use"]').click();
    await page.waitForTimeout(500);
    // Window still visible after tab switch.
    await expect(invWindow).toBeVisible();

    // Screenshot with Inventory window open.
    await page.screenshot({
      path: "/home/th/Documents/GitHub/maplestory-wasm/p3-inventory.png",
      fullPage: false,
    });

    // Close window.
    await closeWindow(page);
    await expect(invWindow).not.toBeVisible({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Equipment window
  // ─────────────────────────────────────────────────────────────────────────
  test("Equipment window opens and closes", async ({ page }) => {
    await loginToIngame(page);

    // Open Equipment window.
    await clickMenuButton(page, "Equip");

    const equipWindow = page.locator('[data-testid="equipment-window"]');
    await expect(equipWindow).toBeVisible({ timeout: 10000 });

    // Close window.
    await closeWindow(page);
    await expect(equipWindow).not.toBeVisible({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Skills window
  // ─────────────────────────────────────────────────────────────────────────
  test("Skills window opens and closes", async ({ page }) => {
    await loginToIngame(page);

    // Open Skills window.
    await clickMenuButton(page, "Skills");

    const skillsWindow = page.locator('[data-testid="skills-window"]');
    await expect(skillsWindow).toBeVisible({ timeout: 10000 });

    // Screenshot with Skills window open.
    await page.screenshot({
      path: "/home/th/Documents/GitHub/maplestory-wasm/p3-skills.png",
      fullPage: false,
    });

    // Close window.
    await closeWindow(page);
    await expect(skillsWindow).not.toBeVisible({ timeout: 5000 });
  });
});
