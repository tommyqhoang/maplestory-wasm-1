import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const COOP_COEP = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

const proxyTarget = "http://localhost:8000";
const proxy = Object.fromEntries(
  ["/build", "/web", "/hd", "/nxFiles", "/wz"].map((p) => [
    p,
    { target: proxyTarget, changeOrigin: true },
  ]),
);

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, headers: COOP_COEP, proxy },
  preview: { headers: COOP_COEP },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["e2e/**", "node_modules/**"],
  },
  define: {
    // Required for React and Zod to run correctly in lib/IIFE mode where
    // Vite does not automatically inject process.env.NODE_ENV.
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: "src/main.tsx",
      name: "MapleUI",
      fileName: () => "maple-ui.js",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        assetFileNames: "maple-ui.[ext]",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
