# Project Startup Guide

## Prerequisites

- Node.js (with npm)
- Python 3.x (must be in system PATH)
- pip

## Install Dependencies

```bash
# Node dependencies
npm install

# Python dependencies
cd python-service
pip install -r requirements.txt
cd ..
```

## Development

```bash
npm run dev
```

Single command handles:
- Vite dev server for renderer (hot reload, port 5173)
- Main process TypeScript compilation
- Electron launch, loads Vite dev server page

Python service is auto-started by the Electron main process via `PythonManager` (default port 5000, auto-allocates random port if occupied). No manual startup needed.

## Testing

```bash
npm run test:run    # Single run, all tests
npm run test        # Watch mode
```

## Production Build

```bash
npm run build           # Compile Electron + renderer
npm run build:python    # PyInstaller bundle Python service to bin/
npm run package:win     # Windows installer (dist/*.exe)
npm run package:mac     # macOS installer (dist/*.dmg)
```

## Runtime Configuration

No `.env` file. Runtime config stored at `%APPDATA%/game-assistant-auto/data/config.json` (Windows):

```json
{
  "pythonPort": 5000,
  "autoPruneDays": 30,
  "debugMode": false
}
```

## Project Structure

```
src/
├── main/           # Electron main process (IPC, services, Python management)
├── renderer/       # React frontend (Ant Design UI)
└── shared/         # Shared types and constants between main/renderer
scripts/            # Postinstall and verification scripts
python-service/     # Flask + OpenCV image matching service
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `electron-vite dev` | Start in development mode |
| `build` | `electron-vite build` | Build for production |
| `test` | `vitest` | Run tests in watch mode |
| `test:run` | `vitest run` | Run tests once |
| `build:python` | `cd python-service && pyinstaller matcher.spec ...` | Bundle Python service |
| `package:win` | `electron-builder --win` | Package Windows installer |
| `package:mac` | `electron-builder --mac` | Package macOS installer |

### Automated Lifecycle Hooks

The following hooks run automatically — no manual intervention needed under normal conditions:

| Hook | When | What it does |
|------|------|-------------|
| `postinstall` | After `npm install` | Verifies electron binary exists; recovers from local cache if missing |
| `predev` | Before `npm run dev` | Verifies electron binary + rebuilds `better-sqlite3` for Electron ABI |
| `prebuild` | Before `npm run build` | Same as `predev` |
| `pretest` | Before `npm test` | Rebuilds `better-sqlite3` for Node.js ABI |

## Environment Setup Notes

### Electron Binary

Electron binary may fail to download from GitHub due to network issues. The `postinstall` script handles this automatically by checking the local cache at `~/AppData/Local/electron/Cache/`. If recovery fails, set the mirror and reinstall:

```bash
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
```

### Native Module ABI

`better-sqlite3` is a C++ addon that must be compiled against the target runtime's ABI. Electron and Node.js use different ABIs, so the same `.node` file cannot serve both.

The lifecycle hooks handle this automatically:

- `predev` / `prebuild` → `electron-rebuild` compiles for Electron's ABI
- `pretest` → `npm rebuild` compiles for Node.js ABI

If you switch between `npm run dev` and `npm test` without running the corresponding script, you may see `NODE_MODULE_VERSION mismatch` errors. The hooks prevent this, but if it occurs:

```bash
# Fix for Electron
npx electron-rebuild -f -w better-sqlite3

# Fix for Node.js (tests)
npm rebuild better-sqlite3
```

### Electron Version Constraint

Electron is pinned to `^41.7.1`. Do NOT upgrade to 42.x until `better-sqlite3` adds support for its V8 API changes (`v8::External::Value()` signature change). Check compatibility at [better-sqlite3 releases](https://github.com/WiseLibs/better-sqlite3/releases) before upgrading.

## Fixes Applied

### 2026-06-02

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `electron-vite` preload entry error | Missing `electron.vite.config.ts` | Created config with explicit main/preload/renderer entries |
| `electron-vite` incompatible with vite 8 | `electron-vite@5` peer dep conflict | Upgraded to `electron-vite@6.0.0-beta.1` |
| Electron binary not downloaded | GitHub connection reset | Downloaded from npmmirror.com, manually extracted |
| `better-sqlite3` compile error with Electron 42 | V8 API breaking changes | Downgraded Electron to 35.7.5 |
| `package.json` main points to source | `"main": "src/main/index.ts"` | Changed to `"main": "out/main/index.js"` |
| Dev mode detection broken | `process.env.ELECTRON_DEV` not set by electron-vite | Changed to `process.env.NODE_ENV_ELECTRON_VITE === 'development'` |
| Database directory not found | Missing `data/` directory creation | Added `fs.mkdirSync(dataDir, { recursive: true })` |
| pnpm virtual store path issues | pnpm `.pnpm` directory breaks module resolution | Switched to npm, deleted `pnpm-lock.yaml` |
| Renderer URL hardcoded | `http://localhost:5173` ignores electron-vite dynamic port | Use `process.env.ELECTRON_RENDERER_URL` |

### 2026-06-03

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `Electron uninstall` error on `npm run dev` | Electron postinstall silently fails to download binary (network issue); `node_modules/electron` left in corrupted state | Created `scripts/postinstall.mjs` with local cache recovery |
| `better-sqlite3` NODE_MODULE_VERSION mismatch | Electron ABI differs from Node.js ABI; `electron-rebuild` breaks test runner | Split rebuild into `predev` (Electron) and `pretest` (Node.js) |
| `better-sqlite3` compile error with Electron 42 | V8 API `v8::External::Value()` signature changed in Electron 42 | Pinned Electron to `^41.7.1`; documented version constraint |
| Electron 42 upgrade caused cascading failures | `better-sqlite3@12.10.0` incompatible with Electron 42's V8 | Added version constraint documentation; automated hooks prevent silent failures |

## Known Gaps (from verification report)

| Level | Issue |
|-------|-------|
| CRITICAL | `MatchResult` type defines `center?: {x,y}` but engine code accesses `result.x` directly |
| CRITICAL | WebSocket frame capture not implemented |
| CRITICAL | Network log real-time streaming to renderer not implemented |
| CRITICAL | Template image file storage service not implemented |
| WARNING | `NetworkMonitor` not wired into `index.ts` startup flow |
| WARNING | Log export IPC handler is a no-op |
| WARNING | Debug toggle not persisted to config.json |

## Troubleshooting

### `Error: Electron uninstall` on `npm run dev`

Electron binary is missing or corrupted. The `postinstall` script should have recovered it, but if not:

```bash
rm -rf node_modules/electron
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
```

### `NODE_MODULE_VERSION mismatch` in tests

Native module was compiled for Electron but tests run under Node.js:

```bash
npm rebuild better-sqlite3
npm test
```

### `NODE_MODULE_VERSION mismatch` in dev

Native module was compiled for Node.js but dev server runs Electron:

```bash
npm run dev
```

The `predev` hook handles this automatically.

### `better-sqlite3` compile errors after upgrading Electron

The `better-sqlite3` native addon may not support the new Electron's V8 API. Check compatibility before upgrading:

```bash
# Check current Electron version
node -e "console.log(require('./node_modules/electron/package.json').version)"

# Check if better-sqlite3 compiles for this version
npx electron-rebuild -f -w better-sqlite3
```

If compilation fails, pin Electron to the last working version (currently `^41.7.1`).

### `npm install` hangs or fails

If `npm install` fails during the `postinstall` step, the electron binary download is likely blocked by network. Use the China mirror:

```bash
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
```
