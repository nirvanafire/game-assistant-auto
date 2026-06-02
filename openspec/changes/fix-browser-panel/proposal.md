## Why

The embedded browser panel has three usability issues that degrade the development and user experience: DevTools auto-opens on every startup in development mode, the default Electron menu bar is visible despite not being needed, and the BrowserView overlay covers the address bar making it impossible to type URLs.

## What Changes

- Remove `openDevTools()` call so DevTools no longer auto-opens on app startup
- Hide the default Electron menu bar via `setMenu(null)`
- Offset the BrowserView bounds vertically so the address bar toolbar area is not covered by the native overlay, allowing user interaction with the URL input

## Non-goals

- Switching from `BrowserView` to `<webview>` tag (different architectural approach, out of scope)
- Adding a dynamic toolbar height measurement system (fixed offset is sufficient for current layout)
- Any changes to the BrowserView's navigation logic or IPC handlers

## Capabilities

### New Capabilities

- `browser-panel`: Browser panel UI fixes — BrowserView overlay offset, menu bar removal, and DevTools startup behavior

### Modified Capabilities

(none)

## Impact

- `src/main/window.ts` — remove `openDevTools()`, add `setMenu(null)`, adjust BrowserView bounds y-offset
- No API, dependency, or cross-platform changes (menu hiding uses `setMenu(null)` which works on Windows; macOS behavior unchanged as it uses a different menu system)
