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

## Environment Setup Notes

### Electron Binary

Electron binary may fail to download from GitHub due to network issues. If `npm install` succeeds but `electron.exe` is missing:

```bash
# Download from mirror
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
node node_modules/electron/install.js
```

Or manually extract from cache: `~/AppData/Local/electron/Cache/`

### Native Module Rebuild

`better-sqlite3` is a native module that must be compiled for the target runtime:

```bash
# For Electron (required before packaging)
npx @electron/rebuild -f -w better-sqlite3

# For Node.js (required for running tests)
npm rebuild better-sqlite3
```

## Fixes Applied (2026-06-02)

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
