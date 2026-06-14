import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Reset the test account's login flag before each test so we never hit
// "That ID is already logged in." from a prior run.
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
// Full DOM entry flow helper: login → world select → channel → char select → in-game
// ---------------------------------------------------------------------------
async function driveEntryFlow(
  page: Page,
  opts: { screenshots?: boolean } = {},
): Promise<void> {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");

  // ── Step 1: DOM login screen ──────────────────────────────────────────────
  // The DOM login input must appear (proves canvas login was replaced).
  await expect(page.locator('[data-testid="login-account"]')).toBeVisible({
    timeout: 30000,
  });

  if (opts.screenshots) {
    await page.screenshot({
      path: "/home/th/Documents/GitHub/maplestory-wasm/p2-login.png",
      fullPage: false,
    });
  }

  await page.locator('[data-testid="login-account"]').fill("wasmteswasmt");
  await page.locator('[data-testid="login-password"]').fill("test1234");
  await page.locator('[data-testid="login-submit"]').click();

  // ── Step 2: World select ──────────────────────────────────────────────────
  // Server sends worldlist; store sets scene → "worldselect".
  const firstWorldBtn = page.locator('[data-testid^="world-"]').first();
  await expect(firstWorldBtn).toBeVisible({ timeout: 20000 });

  if (opts.screenshots) {
    await page.screenshot({
      path: "/home/th/Documents/GitHub/maplestory-wasm/p2-worldselect.png",
      fullPage: false,
    });
  }

  // Click the world to reveal channels.
  await firstWorldBtn.click();

  // ── Step 3: Channel select ────────────────────────────────────────────────
  // Channels render conditionally after a world is selected.
  const firstChannelBtn = page.locator('[data-testid^="channel-"]').first();
  await expect(firstChannelBtn).toBeVisible({ timeout: 10000 });
  await firstChannelBtn.click();

  // ── Step 4: Character select ──────────────────────────────────────────────
  // Engine sends CHARLIST; store sets scene → "charselect".
  const firstCharCard = page.locator('[data-testid^="char-"]').first();
  await expect(firstCharCard).toBeVisible({ timeout: 20000 });

  if (opts.screenshots) {
    await page.screenshot({
      path: "/home/th/Documents/GitHub/maplestory-wasm/p2-charselect.png",
      fullPage: false,
    });
  }

  // Click the character card, then Start.
  await firstCharCard.click();
  await page.locator('[data-testid="char-start"]').click();

  // ── Step 5: In-game ───────────────────────────────────────────────────────
  // Engine transitions to ingame; HUD mounts with HP/MP stats.
  const hudHp = page.locator('[data-testid="hud-hp"]');
  await expect(hudHp).toBeVisible({ timeout: 30000 });
  await expect(hudHp).toContainText(/\d+ \/ \d+/, { timeout: 10000 });
  await expect(hudHp).not.toContainText("0 / 0");

  if (consoleErrors.length) {
    console.warn("[entry flow] browser console errors:", consoleErrors);
  }
}

// ---------------------------------------------------------------------------
// Test 1 (focused assertion): DOM login screen is present on load
// Proves the old in-canvas login was replaced by the DOM entry flow.
// ---------------------------------------------------------------------------
test("DOM login screen is present on page load (not canvas login)", async ({
  page,
}) => {
  test.setTimeout(60000);

  await page.goto("/");

  // The DOM login input must become visible — this is the definitive proof
  // that the Phase 2 DOM entry replaced the old in-canvas login screen.
  const loginInput = page.locator('[data-testid="login-account"]');
  await expect(loginInput).toBeVisible({ timeout: 30000 });
});

// ---------------------------------------------------------------------------
// Test 2: Full DOM entry flow — login → world → channel → char → in-game
// ---------------------------------------------------------------------------
test("full DOM entry flow reaches in-game HUD", async ({ page }) => {
  test.setTimeout(180000);
  resetLoginFlag();

  await driveEntryFlow(page, { screenshots: true });

  // Confirm "WasmHero" name in the status bar.
  const statusBar = page.locator(".hud-status-bar");
  await expect(statusBar).toBeVisible({ timeout: 5000 });
  await expect(statusBar).toContainText("WasmHero");
});
