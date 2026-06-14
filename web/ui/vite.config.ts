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
  test: { environment: "jsdom", globals: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "maple-ui.js",
        assetFileNames: "maple-ui.[ext]",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
