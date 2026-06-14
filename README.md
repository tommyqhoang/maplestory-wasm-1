# 🍁 MapleStory WASM

> **A WebAssembly port of MapleStory v83, playable directly in your browser.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

MapleStory WASM brings the classic MapleStory v83 client to modern web browsers using WebAssembly. The repository contains the WASM client build, a React/TypeScript DOM UI overlay rendered over the game canvas, the local web services used by the browser runtime, and Docker entrypoints for running the web stack. The client is designed to run with Cosmic server.

---

## 🏗️ Architecture

```
┌───────────────────────────┐       ┌──────────────────────────────────────────────┐
│     Web Server (Python)   │       │                Browser (Client)               │
│     web/server.py         │──────▶│  ┌──────────────────┐   ┌───────────────────┐ │
│     http://localhost:8000 │ HTTP  │  │ DOM UI Overlay   │   │  WASM Game Engine │ │
└───────────────────────────┘       │  │ (React + TS)     │◀─▶│  (C++ → WASM,     │ │
                                     │  │ login, HUD,      │   │   GL <canvas>)    │ │
                                     │  │ windows, chat    │   │                   │ │
                                     │  └──────────────────┘   └─────────┬─────────┘ │
                                     │      MapleBridge JSON             │           │
                                     └───────────────────────────────────┼─────┬─────┘
                                                                  WebSocket│     │WebSocket
                                                            (Game Packets) │     │(Assets)
                                                                          ▼     ▼
                                          ┌────────────────┐  ┌───────────────────────────┐
                                          │ WS Proxy       │  │   Assets Server (Python)  │
                                          │ web/ws_proxy.py│  │   ws://localhost:8765     │
                                          │ :8080          │  └───────────────────────────┘
                                          └───────┬────────┘
                                                  │ TCP
                                                  ▼
                                          ┌───────────────────────────┐
                                          │    Cosmic Server (TCP)    │
                                          └───────────────────────────┘
```

### How It Works

1. **WASM Engine** - The C++ MapleStory client is compiled to WebAssembly using Emscripten and renders the game world to a WebGL `<canvas>`. `web/server.py` serves the generated JS/WASM bundle to the browser.
2. **DOM UI Overlay** - A React + TypeScript + Vite app (`web/ui/`) renders the user-facing UI — login, world/character select, the in-game HUD, chat, and the inventory/equipment/skills/stats/shop/NPC windows — as crisp HTML over the canvas. It talks to the engine through the **MapleBridge**, a versioned, schema-validated JSON message protocol. See [DOM UI Overlay](#-dom-ui-overlay).
3. **WebSocket Proxy** - Browsers cannot make raw TCP connections, so a Python proxy bridges WebSocket connections to Cosmic server over TCP.
4. **LazyFS** - A dynamic file system technology that streams game assets (`.nx` files) on-demand via WebSocket and caches them locally in your browser. Assets are only fetched from the network once, providing native loading times on subsequent loads.
5. **Containerized Tooling** - Docker can be used both for serving the project and as a fallback way to build the WASM client.

---

## ⚠️ Required Game Assets

> [!IMPORTANT]
> You **must** provide your own game assets to run this project. We cannot distribute them due to copyright.

### 1. Client Assets (`.nx` files)

To put together the asset set:

1. Take every `.wz` file from **v83** **except** `UI.wz`.
2. Take **only** `UI.wz` from **v153+**.
3. Run all of those `.wz` files through the [WZ to NX converter](./scripts/wz-converter/README.md) to produce `.nx` files.
4. Drop the resulting `.nx` files into `maplestory-wasm/assets/`.

Treat `assets/` as read-only once the files are in place — don't modify anything in it.

---

## 🚀 Quick Start

### Client Build

#### Prefer the docker build first:

```bash
./scripts/docker_build_wasm.sh
```

Useful variants:

```
./scripts/docker_build_wasm.sh --debug
./scripts/docker_build_wasm.sh --jobs 4
```

#### If the local Emscripten and CMake toolchain is available, you can use the local build:

```bash
./scripts/build_wasm.sh
```

Useful variants:

```bash
./scripts/build_wasm.sh --debug
./scripts/build_wasm.sh --jobs 4
```

#### Output:

The client build output is written to `build/`.

### UI Build

The DOM UI overlay is a separate React/TypeScript bundle. Build it with:

```bash
./scripts/build_ui.sh
```

This regenerates the protocol header, type-checks, and emits `web/ui/dist/`, which `web/index.html` loads over the game canvas. See [DOM UI Overlay](#-dom-ui-overlay) for development details.

### Local Deployment

Use local deployment when the toolchain and supporting services are available on the host machine.

Requirements:

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Python** | 3.9+ | Local web services |
| **Emscripten** | 3.1+ | WASM compilation |
| **CMake** | 3.16+ | Build system |

1. Build the client with `./scripts/build_wasm.sh`.
2. Install the local Python dependency:

```bash
pip install -r web/requirements.txt
```

3. Start the web services from the repository root:

```bash
python3 web/server.py
python3 web/ws_proxy.py --ws-port 8080
python3 web/assets_server.py --port 8765 --directory .
```

4. Open **http://localhost:8000**.

The websocket proxy is intended to forward traffic to a running Cosmic server instance.

### Docker Deployment

Use Docker when local deployment is not practical or when you want the containerized stack.

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Docker** | 20.10+ | Includes Docker Compose |

Web stack:

```bash
./scripts/run_all.sh
```

Equivalent direct command:

```bash
./scripts/docker_web_up.sh -d
```

Stop all Docker services:

```bash
./scripts/stop_all.sh
```

Open **http://localhost:8000** after the containers are up.

---

## 📂 Project Structure

```
maplestory-wasm/
├── 📁 build/              # WASM build output (JourneyClient.js/.wasm)
├── 📁 docker/             # Dockerfiles for services
├── 📁 docs/               # Network protocol & reference docs
├── 📁 scripts/            # Build & run scripts
├── 📁 src/
│   ├── client/            # C++ MapleStory client (Graphics, Net, IO, Gameplay…)
│   │   └── IO/UiBridge.*  # C++ side of the MapleBridge JSON protocol
│   └── nlnx/              # Shared NX loading library
├── 📁 web/                # Web infrastructure
│   ├── server.py          # HTTP server (COOP/COEP headers for WASM threads)
│   ├── server_fast.py     # Lightweight static server variant
│   ├── ws_proxy.py        # WebSocket-TCP proxy (game packets)
│   ├── assets_server.py   # NX asset streaming (LazyFS)
│   ├── index.html         # Canvas + UI host page; render-scale/resize logic
│   ├── config.json        # Client connection config
│   ├── hd/                # HD asset overrides (sprite replacements)
│   └── ui/                # React/TypeScript DOM UI overlay (Vite)
│       ├── src/bridge/    # MapleBridge protocol + transport
│       ├── src/store/     # Zustand game state store
│       ├── src/design/    # Window/Tooltip/AssetImage primitives + tokens
│       ├── src/features/  # login, worldselect, charselect, hud, inventory…
│       └── e2e/           # Playwright round-trip specs
├── 📄 docker-compose.yml  # Docker orchestration
├── 📄 AGENTS.md           # Build/run/coding rules for automated agents
├── 📄 LICENSE             # AGPL-3.0 License
└── 📄 README.md           # You are here
```

---

## 🪟 DOM UI Overlay

The user-facing interface lives in `web/ui/` as a **React + TypeScript + Vite** app rendered as crisp HTML over the WASM game canvas. Keeping the UI in the DOM gives sharp text and widgets at any resolution while the engine focuses on rendering the game world.

### MapleBridge protocol

UI and engine communicate over the **MapleBridge** — a versioned, schema-validated JSON message protocol. `web/ui/src/bridge/protocol.spec.json` is the single source of truth:

- **TypeScript** types/validators (Zod) are defined in `web/ui/src/bridge/protocol.ts`.
- **C++** message constants are generated into `src/client/IO/UiBridgeProtocol.h` via `npm run gen:protocol` (also run by `build_ui.sh`); the C++ side is implemented in `src/client/IO/UiBridge.cpp`. **Commit the regenerated header whenever the spec changes.**
- Every inbound message is parsed and validated before reaching the store; malformed payloads are dropped with a console warning rather than corrupting state.

The engine pushes messages such as `stats`, `scene`, `worlds`, `characters`, `inventory`, `equipment`, `skills`, `statsdetail`, `npcDialog`, `shop`, `buffs`, `notice`, and `chat`; the UI sends commands like `login`, `selectWorld`, `selectChar`, `openWindow`, `sendChat`, `useItem`, `allocateAp`, `npcRespond`, `shopAction`, and `setBgm/SfxVolume`.

### Features

- Login, world/channel select, and character select flows
- In-game HUD: status bar (HP/MP/EXP), buff-icon bar, notification toasts, FPS meter
- Multi-channel chat (all / party / buddy / guild / alliance / whisper tabs)
- Inventory (mesos, double-click to equip/use), equipment, skills, and stats windows
- NPC dialog and shop windows with item tooltips
- ESC system menu with settings (BGM/SFX volume, render quality, fullscreen)

### Development

```bash
cd web/ui
npm install
npm run dev        # Vite HMR on :5173 (proxies /build, /web, /hd to :8000)
```

Run the Docker stack (engine + assets at `:8000`) first so the overlay has an engine to bridge to. For a production/integrated build, use `./scripts/build_ui.sh` and open `:8000`.

### Quality checks

| Command (in `web/ui/`) | Purpose |
|------------------------|---------|
| `npm test`             | Vitest unit tests (bridge, store, components) |
| `npm run e2e`          | Playwright round-trip specs against `:8000` |
| `npm run lint`         | ESLint + Prettier |
| `npm run gen:protocol` | Regenerate the C++ protocol header from the spec |
## ⚙️ Configuration

### Web Client Configuration (`web/config.json`)

The `web/config.json` file controls how the browser connects to backend services. If values are missing or `null`, the client will attempt to auto-detect them or fall back to `localhost` defaults.

| Variable | Description |
|----------|-------------|
| `AssetsServerProtocol` | Protocol for the LazyFS assets WebSocket (`ws` or `wss`). |
| `AssetsServerIP`       | IP/Hostname of the LazyFS Assets Server. |
| `AssetsServerPort`     | Port of the LazyFS Assets Server (defaults to `8765`). |
| `ProxyIP`              | IP/Hostname of the WebSocket Proxy for game traffic. |
| `ProxyPort`            | Port of the WebSocket Proxy (defaults to `8080`). |
| `MapleStoryServerIp`   | IP address of the target Cosmic Server (forwarded by proxy). |
| `MapleStoryServerPort` | Port of the target Cosmic Server (defaults to `8484`). |

### Docker Environment

The `docker-compose.yml` provides sensible defaults. Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `IS_DOCKER` | `true` | Enables Docker-specific networking |

---

## 🔧 Development

### Making Changes

1. Edit files under `src/client/`, `src/nlnx/`, `web/`, `scripts/`, or `docker/`
2. Keep `assets/` unchanged
3. **Engine change:** rebuild with `./scripts/build_wasm.sh` (or `./scripts/docker_build_wasm.sh` if the local toolchain is unavailable)
4. **UI change:** rebuild with `./scripts/build_ui.sh`; if you touched the bridge spec, run `npm run gen:protocol` and commit the regenerated `UiBridgeProtocol.h`
5. Re-test the relevant local or Docker workflow you changed (unit, e2e, lint)

### Build Commands

| Command | Description |
|---------|-------------|
| `./scripts/build_wasm.sh` | Build WASM engine (Release) |
| `./scripts/build_wasm.sh --debug` | Build WASM engine with debug symbols |
| `./scripts/build_wasm.sh -j 4` | Build with 4 parallel jobs |
| `./scripts/docker_build_wasm.sh` | Build WASM engine in Docker |
| `./scripts/build_ui.sh` | Build the React DOM UI overlay (`web/ui/dist`) |
| `./scripts/wz-converter/convert.sh` | Convert local `.wz` files to `.nx` files in Docker |
| `./scripts/run_all.sh` | Start the Docker web services |
| `./scripts/docker_web_up.sh -d` | Start the Docker web services directly |
| `./scripts/stop_all.sh` | Stop all services |

---

## 🤝 Contributing

Contributions are welcome! Please read the guidelines below before submitting.

### How to Contribute

1. **Fork** the repository
2. **Create a branch** for your feature: `git checkout -b feature/amazing-feature`
3. **Make changes** and verify the relevant build and runtime flow
4. **Test** your changes locally
5. **Commit** your changes: `git commit -m 'Add amazing feature'`
6. **Push** to your fork: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Guidelines

- Follow the existing code style in each project (C++, Python, shell scripts)
- Keep changes focused and well-documented
- Test across multiple browsers when modifying client code
- Update documentation for user-facing changes

### Areas for Contribution

- 🐛 Bug fixes and stability improvements
- 🎮 Missing game features (skills, NPCs, quests)
- 📖 Documentation improvements
- 🧪 Testing and QA
- 🎨 UI/UX enhancements

---

## ⚠️ Disclaimer

This project is for **educational and preservation purposes only**.

- **MapleStory** is a trademark of **NEXON Korea Corporation**.
- All game assets, art, music, and related content are copyright of their respective owners.
- This project does not distribute any copyrighted game assets.
- Users must provide their own legal copies of game assets (`.nx` or `.wz` files).
- This project is not affiliated with, endorsed by, or connected to NEXON in any way.

**Use responsibly and respect intellectual property rights.**

---

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

See the [LICENSE](LICENSE) file for full details.

---

<div align="center">

**Happy Mapling! 🍄**

*If this project brings back memories, consider giving it a ⭐*

</div>
