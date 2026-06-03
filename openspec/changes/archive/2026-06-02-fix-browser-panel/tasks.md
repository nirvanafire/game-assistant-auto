## 1. DevTools and Menu

- [ ] 1.1 Remove `mainWindow.webContents.openDevTools()` call from `src/main/window.ts` line 45
- [ ] 1.2 Add `mainWindow.setMenu(null)` after window creation in `src/main/window.ts`

## 2. BrowserView Overlay Fix

- [ ] 2.1 Change BrowserView bounds in `src/main/window.ts` from `{ x: 0, y: 0, width: 700, height: 900 }` to `{ x: 0, y: 48, width: 700, height: 852 }` so the toolbar area is not covered

## 3. Verification

- [ ] 3.1 Run the app in dev mode and confirm DevTools does not auto-open
- [ ] 3.2 Confirm the menu bar is not visible
- [ ] 3.3 Confirm the address bar input is clickable and accepts keyboard input
- [ ] 3.4 Type a URL in the address bar, press Enter, and confirm the BrowserView navigates to it
