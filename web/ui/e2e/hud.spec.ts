import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";

type WasmWindow = {
  Module?: { _wasm_set_canvas_size?: unknown };
};

// ---------------------------------------------------------------------------
// Reset the test account's login flag before each test so we never hit
// "That ID is already logged in. Please try again later." from a prior run.
// ---------------------------------------------------------------------------
function resetLoginFlag(): void {
  try {
    execSync(
      `docker exec cosmic-db-1 mysql -u root --password="" cosmic ` +
        `-e "UPDATE accounts SET loggedin=0 WHERE name='wasmteswasmt';"`,
      { stdio: "pipe" },
    );
  } catch {
    // Non-fatal: if Docker isn't available or the account doesn't exist, proceed.
    console.warn("[setup] could not reset login flag — proceeding anyway");
  }
}

// ---------------------------------------------------------------------------
// Shared login helper — drives the full login → world select → char select
// → in-game flow.  Canvas coords: left offset L=40px, CSS scale S=1.5x.
// ---------------------------------------------------------------------------
async function loginToIngame(page: Page): Promise<void> {
  await page.goto("/");

  // The login form is DOM; submitting drives the engine bridge, so wait for
  // the WASM runtime before interacting.
  await page.waitForFunction(
    () =>
      typeof (window as unknown as WasmWindow).Module?._wasm_set_canvas_size ===
      "function",
    null,
    { timeout: 40000 },
  );

  // DOM login form.
  await page.locator('[data-testid="login-account"]').fill("wasmteswasmt");
  await page.locator('[data-testid="login-password"]').fill("test1234");
  await page.locator('[data-testid="login-submit"]').click();

  // World select.
  const world = page.locator('[data-testid^="world-"]').first();
  await expect(world).toBeVisible({ timeout: 20000 });
  await world.click();

  // Channel select.
  const channel = page.locator('[data-testid^="channel-"]').first();
  await expect(channel).toBeVisible({ timeout: 10000 });
  await channel.click();

  // Character select.
  const char = page.locator('[data-testid^="char-"]').first();
  await expect(char).toBeVisible({ timeout: 20000 });
  await char.click();
  await page.locator('[data-testid="char-start"]').click();

  // HUD HP confirms in-game state.
  await expect(page.locator('[data-testid="hud-hp"]')).toBeVisible({
    timeout: 30000,
  });
}

// ---------------------------------------------------------------------------
// Test 1: DOM HUD appears in-game
// ---------------------------------------------------------------------------
test("DOM HUD appears in-game", async ({ page }) => {
  test.setTimeout(120000);
  resetLoginFlag();

  await loginToIngame(page);

  // HP gauge must be visible and contain non-trivial stats.
  const hp = page.locator('[data-testid="hud-hp"]');
  await expect(hp).toBeVisible({ timeout: 10000 });
  await expect(hp).toContainText(/\d+ \/ \d+/);
  await expect(hp).not.toContainText("0 / 0");

  // MP gauge must be visible and contain non-trivial stats.
  const mp = page.locator('[data-testid="hud-mp"]');
  await expect(mp).toBeVisible({ timeout: 5000 });
  await expect(mp).toContainText(/\d+ \/ \d+/);
  await expect(mp).not.toContainText("0 / 0");

  // EXP gauge must be visible (max=0 is game-normal; we only check format).
  const exp = page.locator('[data-testid="hud-exp"]');
  await expect(exp).toBeVisible({ timeout: 5000 });
  await expect(exp).toContainText(/\d+ \/ \d+/);

  // Character name "WasmHero" must appear in the status bar.
  const statusBar = page.locator(".hud-status-bar");
  await expect(statusBar).toBeVisible({ timeout: 5000 });
  await expect(statusBar).toContainText("WasmHero");

  // A level indicator must be shown (Lv.N).
  await expect(statusBar).toContainText(/Lv\.\d+/);
});

// ---------------------------------------------------------------------------
// Test 2: menu button opens a window without crashing
// ---------------------------------------------------------------------------
test("menu button opens a window without crashing", async ({ page }) => {
  test.setTimeout(120000);
  resetLoginFlag();

  await loginToIngame(page);

  // The HUD must be present before we click anything.
  const hp = page.locator('[data-testid="hud-hp"]');
  await expect(hp).toBeVisible({ timeout: 10000 });

  // Click the Inventory button (it's ui-interactive so it receives events).
  const inventoryBtn = page.getByRole("button", { name: "Inventory" });
  await expect(inventoryBtn).toBeVisible({ timeout: 5000 });
  await inventoryBtn.click();

  // Give the engine time to react (in-engine window opens on the canvas).
  await page.waitForTimeout(1000);

  // HUD must still be visible — page hasn't errored or crashed.
  await expect(hp).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 3: chat input clears on send
// ---------------------------------------------------------------------------
test("chat input clears on send", async ({ page }) => {
  test.setTimeout(120000);
  resetLoginFlag();

  await loginToIngame(page);

  // HUD must be present.
  const hp = page.locator('[data-testid="hud-hp"]');
  await expect(hp).toBeVisible({ timeout: 10000 });

  const chatInput = page.locator('[data-testid="hud-chat-input"]');
  await expect(chatInput).toBeVisible({ timeout: 5000 });

  // fill() drives React's controlled-input value correctly.
  await chatInput.fill("hello world");
  await expect(chatInput).toHaveValue("hello world");

  // Press Enter to invoke handleSend(), which calls setText("").
  await chatInput.press("Enter");

  // Input must clear after send.
  await expect(chatInput).toHaveValue("", { timeout: 3000 });
});
