# Eliminate Scrollbars + Fix Drawer Window Resize

## Problem

1. The main Electron window shows both vertical and horizontal scrollbars.
2. Opening a task or task group editor (Drawer) causes the Electron window to physically resize.

## Root Causes

1. **Missing CSS reset**: `index.html` has no styles. Browser defaults give `<body>` 8px margin. The `<Splitter>` uses `height: 100vh`, so total content height = viewport + 16px body margin = overflow.

2. **Drawer renders into `<body>`**: Ant Design's `<Drawer>` defaults to rendering its popup into `<body>`. When the Drawer opens, it can cause `<body>` to expand, and Electron's BrowserWindow auto-adjusts to fit the new content size.

## Solution

### Change 1: CSS reset in `index.html`

Add a `<style>` block to `src/renderer/index.html`:

```css
html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; }
#root { height: 100%; }
```

This removes default browser spacing, prevents body scrolling, and chains height from `html` → `body` → `#root`.

### Change 2: Drawer container targeting

Add `getPopupContainer` prop to both `<Drawer>` components:

- `src/renderer/components/Assistant/TaskList.tsx` — the task editor Drawer
- `src/renderer/components/Assistant/TaskGroupList.tsx` — the task group editor Drawer

```tsx
<Drawer getPopupContainer={() => document.getElementById('root')!} ... />
```

This makes the Drawer render inside `#root` instead of `<body>`, preventing body expansion and the resulting window resize.

## Scope

| File | Change |
|------|--------|
| `src/renderer/index.html` | Add `<style>` block with CSS reset |
| `src/renderer/components/Assistant/TaskList.tsx` | Add `getPopupContainer` to `<Drawer>` |
| `src/renderer/components/Assistant/TaskGroupList.tsx` | Add `getPopupContainer` to `<Drawer>` |

## Out of Scope

- No changes to window creation (`window.ts`)
- No changes to Splitter layout (`App.tsx`)
- No new IPC channels
- No changes to editor components

## Verification

1. Launch the app — no scrollbars should appear on the main window.
2. Open a task editor Drawer — the window should stay at 1400x900.
3. Open a task group editor Drawer — same behavior.
4. Close Drawers — no residual layout issues.
