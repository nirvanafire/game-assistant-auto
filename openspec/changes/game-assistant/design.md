## Context

This is a new project building a desktop application for automating Canvas-based web games. The app embeds a Chromium browser, captures screenshots, performs multi-scale image matching via a Python/OpenCV service, and executes configurable task workflows with simulated mouse clicks.

Key constraints:
- Canvas games have no inspectable DOM elements; automation must be visual
- Window resize and OS DPI scaling require multi-scale template matching
- Cross-platform: Windows (.exe) and macOS (.dmg)
- All code comments and commit messages in English only

## Goals / Non-Goals

**Goals:**
- Embedded browser for loading game web pages
- Image matching with multi-scale support (DPI + window resize compatible)
- Configurable task system with branching, step groups, task groups
- Network monitoring with full capture
- System logging with file persistence and debug toggle
- Cross-platform packaging via GitHub Actions

**Non-goals:**
- External browser attachment
- Mobile platform support
- Multi-window/multi-monitor targeting
- Anti-bot evasion beyond basic automation

## Decisions

### Electron + TypeScript over C++/Qt

Electron provides embedded Chromium (same as the game browser), mature ecosystem, and faster development cycle. C++/Qt would offer better performance but requires significant Qt learning curve. Image processing performance gap is minimal since Python OpenCV uses C++ internally.

**Alternatives considered:**
- C++/Qt 6: Better performance, smaller bundle, but steep learning curve and slower development
- Tauri: Smaller bundle but system webview has quirks with Canvas-heavy games

### Python + OpenCV as persistent subprocess

OpenCV's Python bindings are the most mature image processing ecosystem. Running as a persistent HTTP service avoids per-call startup overhead.

**Alternatives considered:**
- opencv-js (WASM): 4-5x slower, but zero external dependencies
- Native Node.js addon: Fastest, but complex cross-platform compilation
- Electron + sharp: Lighter but less robust matching algorithms

### HTTP for IPC between Electron and Python

HTTP is simple, debuggable (curl), and naturally supports concurrent requests.

**Alternatives considered:**
- stdin/stdout JSON protocol: No port overhead, but harder to debug
- gRPC: Overkill for this use case

### CDP for network monitoring

Chrome DevTools Protocol provides full request/response capture including bodies, which `session.webRequest` API cannot provide.

### SQLite + JSON for persistence

SQLite for structured data (tasks, logs), JSON for import/export. WAL mode for concurrent access.

### Multi-scale matching algorithm

Two-pass approach: coarse scan at 0.25 increments, fine refinement at 0.05 around best match. Scale range centered on current DPI. Scale cache for faster subsequent matches.

## Risks / Trade-offs

- **Python subprocess lifecycle** → Health check + auto-restart manager
- **CDP stability** → Graceful re-attach on detach events
- **macOS code signing** → Requires Apple Developer account; can skip for MVP
- **OpenCV package size (~80-120MB)** → Acceptable for desktop app
- **Base64 transfer overhead** → Consider file-based IPC if profiling shows bottleneck

## Project Structure

```
game-assistant-auto/
├── src/
│   ├── main/                         # Electron main process
│   │   ├── index.ts                  # App entry point
│   │   ├── window.ts                 # BrowserWindow management
│   │   ├── ipc/                      # IPC handler registration
│   │   │   ├── task.ts
│   │   │   ├── capture.ts
│   │   │   ├── network.ts
│   │   │   ├── storage.ts
│   │   │   └── log.ts
│   │   ├── services/
│   │   │   ├── capture.ts            # webContents.capturePage()
│   │   │   ├── matcher-client.ts     # HTTP client to Python service
│   │   │   ├── task-engine.ts        # Task execution state machine
│   │   │   ├── task-group-engine.ts  # Task group execution
│   │   │   ├── clicker.ts            # webContents.sendInputEvent()
│   │   │   ├── network-monitor.ts    # CDP session management
│   │   │   ├── storage.ts            # SQLite + JSON persistence
│   │   │   └── logger.ts             # Logging service (file + IPC)
│   │   ├── python/
│   │   │   ├── manager.ts            # Spawn/health/restart Python subprocess
│   │   │   └── port.ts               # Dynamic port allocation
│   │   └── db/
│   │       ├── schema.ts             # Table creation SQL
│   │       └── migrations.ts         # Schema versioning
│   │
│   ├── renderer/                     # React frontend
│   │   ├── main.tsx                  # React entry
│   │   ├── App.tsx                   # Root layout
│   │   ├── components/
│   │   │   ├── Browser/
│   │   │   │   └── EmbeddedBrowser.tsx
│   │   │   ├── Assistant/
│   │   │   │   ├── TaskGroupList.tsx
│   │   │   │   ├── TaskGroupEditor.tsx
│   │   │   │   ├── TaskList.tsx
│   │   │   │   ├── TaskEditor.tsx
│   │   │   │   ├── StepEditor.tsx
│   │   │   │   └── StepGroupEditor.tsx
│   │   │   ├── Tools/
│   │   │   │   ├── ImageCompare.tsx
│   │   │   │   ├── ClickTest.tsx
│   │   │   │   └── LogViewer.tsx
│   │   │   └── Network/
│   │   │       └── NetworkLog.tsx
│   │   ├── stores/
│   │   │   ├── taskStore.ts
│   │   │   ├── taskGroupStore.ts
│   │   │   ├── networkStore.ts
│   │   │   └── logStore.ts
│   │   └── styles/
│   │
│   └── shared/                       # Shared types between main/renderer
│       ├── types/
│       │   ├── task.ts
│       │   ├── step.ts
│       │   ├── task-group.ts
│       │   ├── network.ts
│       │   └── match-result.ts
│       └── constants.ts
│
├── python-service/                   # Python image matching service
│   ├── main.py                       # Flask entry
│   ├── matcher.py                    # OpenCV matching logic
│   ├── config.py                     # Default parameters
│   └── requirements.txt              # opencv-python-headless, flask, numpy
│
├── resources/                        # Static assets
├── data/                             # Runtime data (gitignored)
├── .github/workflows/
│   ├── release.yml
│   └── ci.yml
├── electron-builder.yml
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Database Schema

```sql
CREATE TABLE task_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    failure_policy TEXT DEFAULT 'STOP' CHECK(failure_policy IN ('STOP','SKIP','RETRY')),
    retry_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_group_items (
    id TEXT PRIMARY KEY,
    task_group_id TEXT NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    "order" INTEGER NOT NULL
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'idle' CHECK(status IN ('idle','running','paused','completed','failed','stopped')),
    settings JSON NOT NULL DEFAULT '{}',
    interrupt_handlers JSON NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE steps (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('IMAGE_MATCH','IMAGE_GROUP','CLICK')),
    "order" INTEGER NOT NULL,
    group_id TEXT REFERENCES step_groups(id) ON DELETE SET NULL,
    config JSON NOT NULL,
    on_match JSON NOT NULL DEFAULT '{}',
    on_miss JSON NOT NULL DEFAULT '{}',
    screenshot_before_match INTEGER DEFAULT 0
);

CREATE TABLE step_groups (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    loop_count INTEGER DEFAULT 1
);

CREATE TABLE task_runs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    result TEXT CHECK(result IN ('completed','failed','stopped')),
    log JSON DEFAULT '[]'
);

CREATE TABLE task_group_runs (
    id TEXT PRIMARY KEY,
    task_group_id TEXT NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    result TEXT CHECK(result IN ('completed','failed','stopped')),
    log JSON DEFAULT '[]'
);

CREATE TABLE network_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    method TEXT,
    url TEXT NOT NULL,
    status_code INTEGER,
    request_headers JSON,
    request_body TEXT,
    response_headers JSON,
    response_body TEXT,
    duration_ms INTEGER,
    resource_type TEXT,
    size INTEGER
);

CREATE INDEX idx_steps_task ON steps(task_id);
CREATE INDEX idx_steps_group ON steps(group_id);
CREATE INDEX idx_task_runs_task ON task_runs(task_id);
CREATE INDEX idx_task_group_items_group ON task_group_items(task_group_id);
CREATE INDEX idx_task_group_runs_group ON task_group_runs(task_group_id);
CREATE INDEX idx_network_logs_ts ON network_logs(timestamp);
```

## IPC Channels

```
Main → Renderer:
  task:status-changed       { taskId, status, currentStepId }
  task:step-result          { taskId, stepId, result }
  task:log                  { taskId, message, level, timestamp }
  task-group:status-changed { taskGroupId, currentItemIndex, itemResults }
  task-group:log            { taskGroupId, message, level, timestamp }
  network:request           { log entry }
  capture:updated           { timestamp }
  log:entry                 { timestamp, level, source, message }
  log:debug-state           { enabled: boolean }

Renderer → Main:
  task:create               { name, settings }
  task:update               { taskId, steps, groups, handlers }
  task:start                { taskId }
  task:pause                { taskId }
  task:stop                 { taskId }
  task:delete               { taskId }
  task-group:create         { name, failurePolicy, taskIds }
  task-group:update         { taskGroupId, name, failurePolicy, taskIds }
  task-group:start          { taskGroupId }
  task-group:stop           { taskGroupId }
  task-group:delete         { taskGroupId }
  log:set-debug             { enabled: boolean }
  log:get-logs              { level?, source?, search?, limit?, offset? }
  log:export                { filePath }
  log:clear-display
```

## Python Service API

```
POST /match
  Request:  { screenshot: base64, template: base64, threshold, scale_range, region? }
  Response: { matched, x, y, confidence, scale }

POST /match-group
  Request:  { screenshot, templates: [{ label, image, threshold }], logic, scale_range }
  Response: { results: [{ label, matched, x, y, confidence, scale }] }

GET /health
  Response: { status: "ok", version, opencv_version }
```

## GitHub Actions Workflow

```
Trigger: git tag v*.*.* or workflow_dispatch

Jobs:
  build-python-win  → build-windows (exe)
  build-python-mac  → build-macos (dmg)
  release           → upload to GitHub Release
```
