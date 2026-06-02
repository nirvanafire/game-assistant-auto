# Packaging & CI/CD Implementation Plan

**Goal:** Configure cross-platform packaging and GitHub Actions CI/CD for automated builds.

**Architecture:** electron-builder packages the app. GitHub Actions workflows handle build and release. Python service is bundled as an extra resource.

---

## Task 1: GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test:run
      - run: npx tsc --noEmit
```

- [ ] **Step 2: Commit**

---

## Task 2: GitHub Actions Release Workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create release workflow**

```yaml
name: Release

on:
  push:
    tags: ['v*.*.*']
  workflow_dispatch:

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: npm ci
      - run: npm run build
      - run: npm run package:win
      - uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: dist/*.exe

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
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

## Task 3: Verify Build

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

- [ ] **Step 3: Verify electron-builder config**

```bash
cat electron-builder.yml
```
