import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:8000",
    headless: true,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
  },
});
