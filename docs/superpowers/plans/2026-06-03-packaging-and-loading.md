# Packaging & Loading Detection Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add PyInstaller packaging for the Python service, update CI/CD to build it, and implement loading screen detection.

**Architecture:** PyInstaller bundles the Python service into a single executable. The electron-builder copies it from `bin/`. Loading detection monitors the BrowserView for loading state changes.

**Tech Stack:** PyInstaller, GitHub Actions, Electron BrowserView events

---

## Task 1: PyInstaller Packaging

**Files:**
- Create: `python-service/matcher.spec`
- Modify: `python-service/requirements.txt`

- [ ] **Step 1: Add pyinstaller to requirements**

Add `pyinstaller>=6.0.0` to `python-service/requirements.txt`:

```
opencv-python-headless>=4.8.0
flask>=3.0.0
numpy>=1.24.0
pyinstaller>=6.0.0
```

- [ ] **Step 2: Create PyInstaller spec file**

Create `python-service/matcher.spec`:

```python
# -*- mode: python ; coding: utf-8 -*-
import sys
from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['cv2', 'flask', 'numpy'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='matcher-service',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
)
```

- [ ] **Step 3: Add build script to package.json**

Add to `scripts` in `package.json`:

```json
"build:python": "cd python-service && pyinstaller matcher.spec --distpath ../bin --workpath ../build/pyinstaller --noconfirm"
```

- [ ] **Step 4: Commit**

---

## Task 2: Update GitHub Actions Release Workflow

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Add Python build step**

The release workflow needs to build the Python service before packaging the Electron app. Update `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags: ['v*.*.*']
  workflow_dispatch:

jobs:
  build-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r python-service/requirements.txt
      - run: npm run build:python
      - uses: actions/upload-artifact@v4
        with:
          name: python-service
          path: bin/

  build-windows:
    needs: build-python
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - uses: actions/download-artifact@v4
        with:
          name: python-service
          path: bin/
      - run: npm ci
      - run: npm run build
      - run: npm run package:win
      - uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: dist/*.exe

  build-macos:
    needs: build-python
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - uses: actions/download-artifact@v4
        with:
          name: python-service
          path: bin/
      - run: npm ci
      - run: npm run build
      - run: npm run package:mac
      - uses: actions/upload-artifact@v4
        with:
          name: macos-installer
          path: dist/*.dmg

  release:
    needs: [build-windows, build-macos]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            windows-installer/*.exe
            macos-installer/*.dmg
```

- [ ] **Step 2: Commit**

---

## Task 3: Loading Screen Detection

**Files:**
- Modify: `src/main/window.ts`
- Modify: `src/renderer/components/Browser/BrowserPanel.tsx`

- [ ] **Step 1: Add loading state events from BrowserView**

In `src/main/window.ts`, emit loading state changes via webContents events:

```typescript
// After creating browserView:
browserView.webContents.on('did-start-loading', () => {
  mainWindow?.webContents.send('browser:loading-state', { loading: true });
});

browserView.webContents.on('did-stop-loading', () => {
  mainWindow?.webContents.send('browser:loading-state', { loading: false });
});

browserView.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
  mainWindow?.webContents.send('browser:loading-state', { loading: false, error: errorDescription });
});
```

- [ ] **Step 2: Update BrowserPanel to show loading state**

Update `src/renderer/components/Browser/BrowserPanel.tsx` to listen for loading events:

```tsx
const [loading, setLoading] = useState(false);

useEffect(() => {
  const api = (window as any).electronAPI;
  if (!api) return;

  const handler = (_event: any, data: { loading: boolean; error?: string }) => {
    setLoading(data.loading);
    if (data.error) {
      message.error(`Page load failed: ${data.error}`);
    }
  };

  api.on('browser:loading-state', handler);
  return () => api.removeAllListeners('browser:loading-state');
}, []);
```

Add loading indicator to the URL bar:

```tsx
<Input
  value={url}
  onChange={e => setUrl(e.target.value)}
  onPressEnter={handleNavigate}
  placeholder="Enter URL..."
  style={{ width: 400 }}
  suffix={loading ? <Spin size="small" /> : null}
/>
```

- [ ] **Step 3: Add test for loading state**

Add to BrowserPanel tests (if they exist) or verify manually.

- [ ] **Step 4: Commit**

---

## Task 4: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```
