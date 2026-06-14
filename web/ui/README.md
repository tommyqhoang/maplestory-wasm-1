# MapleStory DOM UI (overlay)

React + TypeScript + Vite UI rendered over the WASM game canvas.

## Dev (HMR)

1. Ensure the Docker stack is up (engine + assets at :8000).
2. `cd web/ui && npm install && npm run dev` -> open http://localhost:5173
   (Vite proxies /build, /web, /hd to :8000 and sets COOP/COEP.)

## Production / integrated

- `./scripts/build_ui.sh` -> outputs `web/ui/dist`, served by the Python server.
- `web/index.html` loads `/web/ui/dist/maple-ui.js`.

## Protocol

- `src/bridge/protocol.spec.json` is the source of truth.
- `npm run gen:protocol` regenerates `src/client/IO/UiBridgeProtocol.h`.
- Run it whenever you change the spec; commit the generated header.

## Tests

- `npm test` (Vitest unit), `npm run e2e` (Playwright round-trip vs :8000), `npm run lint`.
