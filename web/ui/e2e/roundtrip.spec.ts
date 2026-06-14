import { test, expect } from "@playwright/test";

test("overlay mounts and shows a scene", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => typeof (window as any).Module?._wasm_set_canvas_size === "function", null, { timeout: 25000 });
  const probe = page.locator(".phase0-probe");
  await expect(probe).toBeVisible({ timeout: 15000 });
  await expect(probe).toContainText(/scene: (login|ingame|loading)/, { timeout: 15000 });
});

test("ping round-trips through the engine", async ({ page }) => {
  await page.goto("/");
  // Wait for the WASM exports to be assigned (ccall + the specific bridge export).
  await page.waitForFunction(
    () => typeof (window as any).Module?._maple_bridge_send === "function",
    null,
    { timeout: 25000 }
  );
  // The loading overlay (pointer-events covers the button) may persist if the
  // game engine's WebSocket fails before onRuntimeInitialized. Playwright's
  // force:true bypasses actionability checks but Chromium still blocks the
  // synthetic mouse event through the overlay. Use evaluate() to dispatch a
  // native DOM click that bubbles through React's event delegation instead.
  await page.evaluate(() =>
    (document.querySelector(".phase0-probe button") as HTMLButtonElement)?.click()
  );
  await expect(page.locator(".phase0-probe")).toContainText(/last pong: \d+/, { timeout: 5000 });
});

test("live stats reach the overlay in-game", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => typeof (window as any).Module?._wasm_set_canvas_size === "function", null, { timeout: 25000 });
  // Wait for onRuntimeInitialized to complete and the loading overlay to be removed
  // (600ms settle + 700ms CSS fade = ~1.3s, give it 10s).
  await page.locator("#loading").waitFor({ state: "detached", timeout: 10000 });
  // Allow the login screen to fully render.
  await page.waitForTimeout(2000);
  const L = 40, S = 1.5, g = (x: number, y: number): [number, number] => [L + x * S, y * S];
  await page.mouse.click(...g(390, 261));
  await page.keyboard.type("wasmteswasmt", { delay: 35 });
  await page.keyboard.press("Tab");
  await page.keyboard.type("test1234", { delay: 35 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  await page.mouse.click(770, 312);
  await page.waitForTimeout(2500);
  await page.mouse.click(...g(130, 210));
  await page.waitForTimeout(700);
  await page.mouse.click(...g(626, 392));
  await page.waitForTimeout(4000);
  await expect(page.locator(".phase0-probe")).toContainText(/HP: \d+ \/ \d+/);
  await expect(page.locator(".phase0-probe")).not.toContainText("HP: 0 / 0");
});
