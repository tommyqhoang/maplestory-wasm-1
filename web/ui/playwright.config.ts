import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  // Tests share a single game account (wasmteswasmt); the server allows only
  // one live session at a time, so they must run serially, not in parallel.
  fullyParallel: false,
  workers: 1,
  // Engine boot + LazyFS map streaming over HTTP is timing-sensitive; one retry
  // absorbs cold-cache slowness without masking real failures.
  retries: 1,
  use: {
    baseURL: "http://localhost:8000",
    headless: true,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
  },
});
