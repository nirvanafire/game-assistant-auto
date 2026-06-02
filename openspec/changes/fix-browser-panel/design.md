## Context

The app uses Electron's `BrowserView` to embed a browser panel alongside the React renderer. Three usability issues exist:

1. `mainWindow.webContents.openDevTools()` is called unconditionally in dev mode, opening DevTools on every startup
2. No menu configuration exists, so Electron's default menu bar (File, Edit, View, etc.) is visible
3. `BrowserView.setBounds({ x: 0, y: 0, ... })` places the native overlay at the top of the window, covering the renderer's address bar toolbar and preventing any mouse/keyboard interaction with it

The BrowserView is a native Chromium view that renders on top of the renderer's DOM — it intercepts all input in its bounds region.

## Goals / Non-Goals

**Goals:**
- DevTools does not auto-open on app startup
- Default Electron menu bar is hidden
- Address bar input is interactive (not covered by BrowserView)

**Non-Goals:**
- Switching from BrowserView to `<webview>` tag
- Dynamic toolbar height measurement
- macOS-specific menu handling (current platform is Windows)

## Decisions

### Remove `openDevTools()` call

Delete the line `mainWindow.webContents.openDevTools()` from `src/main/window.ts`. DevTools remains accessible via F12 / Ctrl+Shift+I (Electron's built-in shortcut) if needed for debugging.

**Alternatives considered:**
- Keep the call but gate it behind a more specific env var — rejected as unnecessary complexity for a single developer workflow

### Use `setMenu(null)` to hide menu

Call `mainWindow.setMenu(null)` after window creation. This removes the menu bar on Windows. Electron's default keyboard shortcuts (copy, paste, etc.) continue to work without the menu.

**Alternatives considered:**
- `Menu.setApplicationMenu(null)` — equivalent on Windows but more relevant for macOS; `setMenu(null)` is the correct per-window API on Windows

### Offset BrowserView bounds to leave toolbar space

Change `browserView.setBounds({ x: 0, y: 0, width: 700, height: 900 })` to use `y: 48` (the toolbar height) so the BrowserView starts below the address bar area. The toolbar height of 48px accounts for: 8px top padding + ~32px control height + 8px bottom padding + 1px border.

The BrowserView height is reduced by the same offset to stay within window bounds: `height: 900 - 48`.

**Alternatives considered:**
- IPC-based dynamic height measurement from renderer — rejected as over-engineering for a fixed layout
- Using `<webview>` tag instead — different architectural approach, out of scope
- Using `webPreferences.webviewTag` — not needed since we keep BrowserView

## Risks / Trade-offs

- [Fixed offset fragility] If the toolbar height changes (e.g., different font size, added buttons), the BrowserView offset must be manually updated. Mitigation: the toolbar uses Ant Design's fixed sizing, so this is unlikely to change frequently.
- [Window resize] The BrowserView bounds are set once at creation. If the window is resized, the BrowserView width/height won't adjust. Mitigation: this is an existing limitation unrelated to this change; resize handling can be added separately if needed.
