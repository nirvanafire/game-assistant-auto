## 1. Project Scaffolding

- [ ] 1.1 Initialize Electron + TypeScript project with electron-vite
- [ ] 1.2 Configure React + UI component library (Ant Design or similar)
- [ ] 1.3 Set up project structure (src/main, src/renderer, src/shared, python-service)
- [ ] 1.4 Configure electron-builder for Windows and macOS
- [ ] 1.5 Set up GitHub Actions CI workflow (lint, type-check)

## 2. Core Infrastructure

- [ ] 2.1 Implement SQLite database schema and migration system
- [ ] 2.2 Implement Python subprocess manager (spawn, health check, auto-restart, port allocation)
- [ ] 2.3 Implement IPC channel registration pattern
- [ ] 2.4 Implement main window layout (splitter: browser left, panel right)

## 3. Python Image Matching Service

- [ ] 3.1 Implement Python Flask service with /health endpoint
- [ ] 3.2 Implement single template matching (POST /match) with multi-scale algorithm
- [ ] 3.3 Implement group matching (POST /match-group) with ALL/ANY logic
- [ ] 3.4 Implement PyInstaller packaging configuration

## 4. Browser & Screenshot

- [ ] 4.1 Implement embedded browser component (BrowserView)
- [ ] 4.2 Implement screenshot capture service (webContents.capturePage)
- [ ] 4.3 Implement matcher client (HTTP calls to Python service from main process)

## 5. Task Engine

- [ ] 5.1 Implement task CRUD (create, read, update, delete) with SQLite persistence
- [ ] 5.2 Implement IMAGE_MATCH step execution (capture → match → branch)
- [ ] 5.3 Implement IMAGE_GROUP step execution
- [ ] 5.4 Implement CLICK step execution (webContents.sendInputEvent)
- [ ] 5.5 Implement variable capture (match results → task variable map)
- [ ] 5.6 Implement step group execution with loop control
- [ ] 5.7 Implement branching logic (onMatch/onMiss transitions)
- [ ] 5.8 Implement interrupt handlers (pre-scan before each step)
- [ ] 5.9 Implement step timeout and task global timeout
- [ ] 5.10 Implement task run history logging

## 6. Task Group Engine

- [ ] 6.1 Implement task group CRUD (create, update, delete, add/remove/reorder items)
- [ ] 6.2 Implement task group execution engine (serial task execution, failure policy)
- [ ] 6.3 Implement task group run history logging

## 7. UI - Assistant Module

- [ ] 7.1 Implement task list view (display, run, edit, delete)
- [ ] 7.2 Implement task editor (name, settings, interrupt handlers)
- [ ] 7.3 Implement step editor (type-specific config forms)
- [ ] 7.4 Implement step group editor
- [ ] 7.5 Implement task group list view (display, run, edit, delete)
- [ ] 7.6 Implement task group editor (name, failure policy, add/remove/reorder tasks)
- [ ] 7.7 Implement task group execution status display (current task, progress, logs)
- [ ] 7.8 Implement task execution status display (current step, progress, logs)

## 8. UI - Tools Module

- [ ] 8.1 Implement image compare tool (upload two images, test matching)
- [ ] 8.2 Implement click test tool (enter coordinates, simulate click)
- [ ] 8.3 Implement log viewer (real-time display, level filter, source filter, search, clear, export)

## 9. Network Monitor

- [ ] 9.1 Implement CDP debugger attachment and Network.enable
- [ ] 9.2 Implement network log capture (request, response, timing, WebSocket)
- [ ] 9.3 Implement network log persistence (SQLite, large body file storage)
- [ ] 9.4 Implement network log UI (table, filters, detail view)
- [ ] 9.5 Implement network log export (JSON)

## 10. Logging System

- [ ] 10.1 Implement logger service (file write, rotation by day and 10MB size, async)
- [ ] 10.2 Implement global debug toggle (persist to config.json)
- [ ] 10.3 Implement log auto-cleanup (delete files older than 30 days on startup)
- [ ] 10.4 Implement log IPC channels (log:entry, log:set-debug, log:get-logs, log:export)
- [ ] 10.5 Implement log viewer UI (real-time display, level filter, source filter, search, clear, export)
- [ ] 10.6 Integrate logger into all services (TaskEngine, Matcher, Clicker, Network, Python, Storage)

## 11. Packaging & CI/CD

- [ ] 11.1 Configure electron-builder.yml with Python service bundling
- [ ] 11.2 Create GitHub Actions release workflow (build-python → build-app → release)
- [ ] 11.3 Test Windows exe build
- [ ] 11.4 Test macOS dmg build
- [ ] 11.5 Configure macOS code signing (certificate setup)

## 12. Polish & Edge Cases

- [ ] 12.1 Implement task and task group JSON import/export
- [ ] 12.2 Implement loading screen detection
- [ ] 12.3 Implement Python service crash recovery during task execution
- [ ] 12.4 Performance optimization: scale caching, ROI-based matching
- [ ] 12.5 App configuration (data directory, auto-prune settings)
