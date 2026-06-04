# Eliminate Scrollbars + Fix Drawer Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove main window scrollbars and prevent the Electron window from resizing when Drawers open.

**Architecture:** Add CSS reset to `index.html` to eliminate body margin/overflow. Add `getPopupContainer` to Ant Design Drawers so they render inside `#root` instead of `<body>`, preventing body expansion.

**Tech Stack:** React, Ant Design, Electron

---

### Task 1: CSS Reset in index.html

**Files:**
- Modify: `src/renderer/index.html`

- [ ] **Step 1: Add CSS reset style block**

Add a `<style>` block inside `<head>` of `src/renderer/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Game Assistant</title>
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; }
    #root { height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/index.html
git commit -m "fix: add CSS reset to eliminate main window scrollbars"
```

---

### Task 2: Drawer Container Fix

**Files:**
- Modify: `src/renderer/components/Assistant/TaskList.tsx:126`
- Modify: `src/renderer/components/Assistant/TaskGroupList.tsx:121`

- [ ] **Step 1: Add getPopupContainer to TaskList Drawer**

In `src/renderer/components/Assistant/TaskList.tsx`, add `getPopupContainer` prop to the `<Drawer>` at line 126:

```tsx
<Drawer
  title="编辑任务"
  open={drawerTaskId !== null}
  onClose={() => setDrawerTaskId(null)}
  size="large"
  destroyOnClose
  getPopupContainer={() => document.getElementById('root')!}
>
```

- [ ] **Step 2: Add getPopupContainer to TaskGroupList Drawer**

In `src/renderer/components/Assistant/TaskGroupList.tsx`, add `getPopupContainer` prop to the `<Drawer>` at line 121:

```tsx
<Drawer
  title="编辑任务组"
  open={drawerGroupId !== null}
  onClose={() => setDrawerGroupId(null)}
  size="large"
  destroyOnClose
  getPopupContainer={() => document.getElementById('root')!}
>
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Assistant/TaskList.tsx src/renderer/components/Assistant/TaskGroupList.tsx
git commit -m "fix: render Drawers inside #root to prevent window resize"
```

---

### Task 3: Manual Verification

- [ ] **Step 1: Launch the app and verify no scrollbars**

Run the app in development mode. Confirm the main window has no vertical or horizontal scrollbars.

- [ ] **Step 2: Open task editor Drawer and verify window stays fixed**

Double-click a task or click the edit button. Confirm the Electron window does not resize. Confirm the Drawer overlays correctly.

- [ ] **Step 3: Open task group editor Drawer and verify**

Switch to task groups view. Double-click a group or click edit. Confirm same behavior as Step 2.

- [ ] **Step 4: Close Drawers and verify no residual issues**

Close all Drawers. Confirm the layout returns to normal with no scrollbars.
