# Game Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop application that automates Canvas-based web games via embedded browser, image matching, and configurable task workflows.

**Architecture:** Electron main process manages SQLite persistence, Python/OpenCV subprocess, and CDP-based network monitoring. React renderer provides UI for task configuration, execution monitoring, and debugging tools. IPC bridges main and renderer.

**Tech Stack:** Electron 35, TypeScript 6, React 19, Ant Design 6, Zustand 5, better-sqlite3, Python 3 + OpenCV + Flask, Vitest, PyInstaller, electron-builder

---

## File Structure

```
src/
  shared/
    constants.ts              # IPC channel names
    types/
      task.ts                 # Task, Step, StepGroup types
      task-group.ts           # TaskGroup, TaskGroupItem types
      log.ts                  # LogEntry type
      match-result.ts         # MatchResult type
  main/
    index.ts                  # App entry, service wiring
    window.ts                 # BrowserWindow creation
    preload.ts                # contextBridge API
    db/
      schema.ts               # CREATE TABLE statements
      migrations.ts           # Schema versioning
    ipc/
      task.ts                 # Task CRUD + execution IPC
      task-group.ts           # Task group CRUD + execution IPC
      log.ts                  # Log IPC handlers
      network.ts              # Network IPC handlers
      registry.ts             # IPC handler registration pattern
    services/
      task-engine.ts          # Task execution state machine
      task-group-engine.ts    # Task group serial execution
      storage.ts              # SQLite CRUD
      capture.ts              # webContents.capturePage()
      matcher-client.ts       # HTTP client to Python service
      clicker.ts              # webContents.sendInputEvent()
      network-monitor.ts      # CDP session management
      logger.ts               # File + IPC logging
      config.ts               # App configuration
    python/
      manager.ts              # Spawn/health/restart
      port.ts                 # Dynamic port allocation
  renderer/
    main.tsx                  # React entry
    App.tsx                   # Root layout (Splitter + Tabs)
    components/
      Browser/BrowserPanel.tsx
      Assistant/
        TaskList.tsx
        TaskEditor.tsx
        StepEditor.tsx
        TaskGroupList.tsx
        TaskGroupEditor.tsx
        ExecutionStatus.tsx
      Tools/
        LogViewer.tsx
        ImageCompare.tsx
        ClickTest.tsx
      Network/NetworkLog.tsx
    stores/
      taskStore.ts
      logStore.ts
      networkStore.ts
python-service/
  main.py                     # Flask entry
  matcher.py                  # OpenCV matching
  config.py                   # Default parameters
  requirements.txt
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `electron.vite.config.ts`, `electron-builder.yml`
- Create: `src/main/index.ts`, `src/main/window.ts`, `src/main/preload.ts`
- Create: `src/renderer/main.tsx`, `src/renderer/index.html`
- Create: `vitest.config.ts`

- [ ] **Step 1: Initialize project and install dependencies**

```bash
npm init -y
npm install electron antd react react-dom zustand better-sqlite3 uuid
npm install -D typescript @types/react @types/react-dom @types/better-sqlite3 @types/uuid
npm install -D electron-vite vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Write the failing test for shared types**

Create `src/shared/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('shared types compile', () => {
  it('imports task types without error', async () => {
    const mod = await import('../types/task');
    expect(mod).toBeDefined();
  });

  it('imports task-group types without error', async () => {
    const mod = await import('../types/task-group');
    expect(mod).toBeDefined();
  });

  it('imports constants without error', async () => {
    const mod = await import('../constants');
    expect(mod.IPC_CHANNELS).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/shared/__tests__/types.test.ts
```

Expected: FAIL — modules don't exist yet.

- [ ] **Step 4: Create shared types and constants**

Create `src/shared/types/task.ts`:

```typescript
export type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
export type StepType = 'IMAGE_MATCH' | 'IMAGE_GROUP' | 'CLICK';

export interface TaskSettings {
  screenshotBeforeMatch: boolean;
  maxRetries: number;
  globalTimeoutMs: number;
  stepTimeoutMs: number;
}

export interface InterruptHandler {
  id: string;
  label: string;
  templatePath: string;
  threshold: number;
  action: 'CLICK_AT_MATCH' | 'CLICK_FIXED';
  fixedCoords?: { x: number; y: number };
  priority: number;
}

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  settings: TaskSettings;
  interruptHandlers: InterruptHandler[];
  createdAt: string;
  updatedAt: string;
}

export interface StepConfig {
  templatePath?: string;
  threshold?: number;
  delayMs?: number;
  retryCount?: number;
  retryIntervalMs?: number;
  scaleRange?: [number, number];
  templates?: Array<{ label: string; templatePath: string; threshold: number }>;
  logic?: 'ALL' | 'ANY';
  source?: 'fixed' | 'from_step';
  fixedCoords?: { x: number; y: number };
  stepId?: string;
}

export interface StepTransition {
  action?: 'END_TASK' | 'END_GROUP_LOOP' | 'NEXT';
  nextStepId?: string;
}

export interface Step {
  id: string;
  taskId: string;
  type: StepType;
  order: number;
  groupId: string | null;
  config: StepConfig;
  onMatch: StepTransition;
  onMiss: StepTransition;
  screenshotBeforeMatch: boolean;
}

export interface StepGroup {
  id: string;
  taskId: string;
  name: string;
  loopCount: number;
}
```

Create `src/shared/types/task-group.ts`:

```typescript
export type FailurePolicy = 'STOP' | 'SKIP' | 'RETRY';

export interface TaskGroup {
  id: string;
  name: string;
  failurePolicy: FailurePolicy;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskGroupItem {
  id: string;
  taskGroupId: string;
  taskId: string;
  order: number;
}

export interface TaskGroupItemRun {
  itemOrder: number;
  taskId: string;
  result?: 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  endedAt?: string;
  taskRunId?: string;
}

export interface TaskGroupRun {
  id: string;
  taskGroupId: string;
  startedAt: string;
  endedAt?: string;
  result?: 'completed' | 'failed' | 'stopped';
  items: TaskGroupItemRun[];
}
```

Create `src/shared/types/match-result.ts`:

```typescript
export interface MatchResult {
  matched: boolean;
  x?: number;
  y?: number;
  confidence?: number;
  scale?: number;
}

export interface GroupMatchResult {
  results: Array<MatchResult & { label: string }>;
}
```

Create `src/shared/types/log.ts`:

```typescript
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
}
```

Create `src/shared/constants.ts`:

```typescript
export const IPC_CHANNELS = {
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_LIST: 'task:list',
  TASK_GET: 'task:get',
  TASK_START: 'task:start',
  TASK_PAUSE: 'task:pause',
  TASK_STOP: 'task:stop',
  TASK_STATUS_CHANGED: 'task:status-changed',
  TASK_STEP_RESULT: 'task:step-result',
  TASK_LOG: 'task:log',

  STEP_CREATE: 'step:create',
  STEP_UPDATE: 'step:update',
  STEP_DELETE: 'step:delete',
  STEP_LIST: 'step:list',
  STEP_REORDER: 'step:reorder',

  STEP_GROUP_CREATE: 'step-group:create',
  STEP_GROUP_UPDATE: 'step-group:update',
  STEP_GROUP_DELETE: 'step-group:delete',
  STEP_GROUP_LIST: 'step-group:list',

  TASK_GROUP_CREATE: 'task-group:create',
  TASK_GROUP_UPDATE: 'task-group:update',
  TASK_GROUP_DELETE: 'task-group:delete',
  TASK_GROUP_LIST: 'task-group:list',
  TASK_GROUP_GET: 'task-group:get',
  TASK_GROUP_START: 'task-group:start',
  TASK_GROUP_STOP: 'task-group:stop',
  TASK_GROUP_ADD_ITEM: 'task-group:add-item',
  TASK_GROUP_REMOVE_ITEM: 'task-group:remove-item',
  TASK_GROUP_GET_ITEMS: 'task-group:get-items',
  TASK_GROUP_STATUS_CHANGED: 'task-group:status-changed',

  LOG_ENTRY: 'log:entry',
  LOG_SET_DEBUG: 'log:set-debug',
  LOG_GET_LOGS: 'log:get-logs',
  LOG_CLEAR_DISPLAY: 'log:clear-display',
  LOG_EXPORT: 'log:export',
  LOG_DEBUG_STATE: 'log:debug-state',

  NETWORK_START: 'network:start',
  NETWORK_STOP: 'network:stop',
  NETWORK_GET_LOGS: 'network:get-logs',
  NETWORK_CLEAR: 'network:clear',
  NETWORK_EXPORT: 'network:export',
  NETWORK_REQUEST: 'network:request',

  CAPTURE_SCREENSHOT: 'capture:screenshot',
  CAPTURE_TEMPLATE: 'capture:template',

  MATCH_SINGLE: 'match:single',
  MATCH_GROUP: 'match:group',
  MATCH_HEALTH: 'match:health',

  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_BACK: 'browser:back',
  BROWSER_FORWARD: 'browser:forward',
  BROWSER_RELOAD: 'browser:reload',

  IMPORT_TASKS: 'import:tasks',
  EXPORT_TASKS: 'export:tasks',
} as const;
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/shared/__tests__/types.test.ts
```

Expected: PASS.

- [ ] **Step 6: Create project config files**

Create `tsconfig.json`, `electron.vite.config.ts`, `electron-builder.yml` with the settings shown in the File Structure section.

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with shared types and config"
```

---

## Task 2: SQLite Schema & Migrations

**Files:**
- Create: `src/main/db/schema.ts`
- Create: `src/main/db/migrations.ts`
- Create: `src/main/db/__tests__/schema.test.ts`
- Create: `src/main/db/__tests__/migrations.test.ts`

- [ ] **Step 1: Write failing tests for schema**

Create `src/main/db/__tests__/schema.test.ts`:

```typescript
import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { createSchema } from '../schema';

describe('createSchema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  it('creates all required tables', () => {
    createSchema(db);
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('schema_version');
    expect(tableNames).toContain('task_groups');
    expect(tableNames).toContain('task_group_items');
    expect(tableNames).toContain('tasks');
    expect(tableNames).toContain('steps');
    expect(tableNames).toContain('step_groups');
    expect(tableNames).toContain('task_runs');
    expect(tableNames).toContain('task_group_runs');
    expect(tableNames).toContain('network_logs');
  });

  it('creates indexes', () => {
    createSchema(db);
    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`)
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_steps_task');
    expect(indexNames).toContain('idx_task_group_items_group');
    expect(indexNames).toContain('idx_task_group_runs_group');
    expect(indexNames).toContain('idx_network_logs_ts');
  });

  it('enables foreign keys', () => {
    createSchema(db);
    const result = db.pragma('foreign_keys', { simple: true });
    expect(result).toBe(1);
  });

  it('inserts initial schema version 1', () => {
    createSchema(db);
    const row = db.prepare('SELECT version FROM schema_version').get() as { version: number };
    expect(row.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/db/__tests__/schema.test.ts
```

Expected: FAIL — `schema.ts` doesn't exist.

- [ ] **Step 3: Implement schema.ts**

Create `src/main/db/schema.ts`:

```typescript
import type Database from 'better-sqlite3';

export function createSchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      failure_policy TEXT DEFAULT 'STOP' CHECK(failure_policy IN ('STOP','SKIP','RETRY')),
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_group_items (
      id TEXT PRIMARY KEY,
      task_group_id TEXT NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'idle' CHECK(status IN ('idle','running','paused','completed','failed','stopped')),
      settings JSON NOT NULL DEFAULT '{}',
      interrupt_handlers JSON NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS steps (
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

    CREATE TABLE IF NOT EXISTS step_groups (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      loop_count INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS task_runs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      result TEXT CHECK(result IN ('completed','failed','stopped')),
      log JSON DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS task_group_runs (
      id TEXT PRIMARY KEY,
      task_group_id TEXT NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      result TEXT CHECK(result IN ('completed','failed','stopped')),
      log JSON DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS network_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      method TEXT,
      url TEXT NOT NULL,
      status_code INTEGER,
      request_headers JSON,
      request_body TEXT,
      response_headers JSON,
      response_body TEXT,
      response_body_path TEXT,
      duration_ms INTEGER,
      resource_type TEXT,
      size INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_steps_task ON steps(task_id);
    CREATE INDEX IF NOT EXISTS idx_steps_group ON steps(group_id);
    CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_group_items_group ON task_group_items(task_group_id);
    CREATE INDEX IF NOT EXISTS idx_task_group_runs_group ON task_group_runs(task_group_id);
    CREATE INDEX IF NOT EXISTS idx_network_logs_ts ON network_logs(timestamp);

    INSERT OR IGNORE INTO schema_version (version) VALUES (1);
  `);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/db/__tests__/schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing test for migrations**

Create `src/main/db/__tests__/migrations.test.ts`:

```typescript
import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { createSchema } from '../schema';
import { runMigrations, getCurrentVersion } from '../migrations';

describe('migrations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  it('returns version 1 after initial schema', () => {
    expect(getCurrentVersion(db)).toBe(1);
  });

  it('runMigrations is idempotent', () => {
    runMigrations(db);
    runMigrations(db);
    expect(getCurrentVersion(db)).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 6: Implement migrations.ts**

Create `src/main/db/migrations.ts`:

```typescript
import type Database from 'better-sqlite3';

export function getCurrentVersion(db: Database.Database): number {
  const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number } | undefined;
  return row?.version ?? 0;
}

export function runMigrations(db: Database.Database): void {
  const currentVersion = getCurrentVersion(db);
  // Future migrations go here:
  // if (currentVersion < 2) { migrateV2(db); }
}
```

- [ ] **Step 7: Run migrations test**

```bash
npx vitest run src/main/db/__tests__/migrations.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/main/db/
git commit -m "feat: SQLite schema and migration system"
```

---

## Task 3: Storage Service

**Files:**
- Create: `src/main/services/storage.ts`
- Create: `src/main/services/__tests__/storage.test.ts`

- [ ] **Step 1: Write failing tests for task CRUD**

Create `src/main/services/__tests__/storage.test.ts`:

```typescript
import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { createSchema } from '../../db/schema';
import { StorageService } from '../storage';

describe('StorageService', () => {
  let db: Database.Database;
  let storage: StorageService;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    storage = new StorageService(db);
  });

  describe('tasks', () => {
    it('creates and retrieves a task', () => {
      const task = storage.createTask({ name: 'Test Task' });
      expect(task.id).toBeDefined();
      expect(task.name).toBe('Test Task');
      expect(task.status).toBe('idle');

      const retrieved = storage.getTask(task.id);
      expect(retrieved?.name).toBe('Test Task');
    });

    it('lists all tasks', () => {
      storage.createTask({ name: 'Task A' });
      storage.createTask({ name: 'Task B' });
      const tasks = storage.listTasks();
      expect(tasks).toHaveLength(2);
    });

    it('updates a task', () => {
      const task = storage.createTask({ name: 'Old Name' });
      storage.updateTask(task.id, { name: 'New Name' });
      expect(storage.getTask(task.id)?.name).toBe('New Name');
    });

    it('deletes a task', () => {
      const task = storage.createTask({ name: 'Delete Me' });
      storage.deleteTask(task.id);
      expect(storage.getTask(task.id)).toBeUndefined();
    });
  });

  describe('steps', () => {
    it('creates and lists steps for a task', () => {
      const task = storage.createTask({ name: 'T' });
      storage.createStep({
        taskId: task.id, type: 'IMAGE_MATCH', order: 1,
        config: { templatePath: '/img.png', threshold: 0.8 },
        onMatch: {}, onMiss: {},
      });
      const steps = storage.listSteps(task.id);
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('IMAGE_MATCH');
    });

    it('deletes a step', () => {
      const task = storage.createTask({ name: 'T' });
      const step = storage.createStep({
        taskId: task.id, type: 'CLICK', order: 1,
        config: { source: 'fixed', fixedCoords: { x: 10, y: 20 } },
        onMatch: {}, onMiss: {},
      });
      storage.deleteStep(step.id);
      expect(storage.listSteps(task.id)).toHaveLength(0);
    });
  });

  describe('task groups', () => {
    it('creates and retrieves a task group', () => {
      const group = storage.createTaskGroup({ name: 'Group A', failurePolicy: 'STOP' });
      expect(group.name).toBe('Group A');
      expect(group.failurePolicy).toBe('STOP');
    });

    it('adds items to a task group', () => {
      const task = storage.createTask({ name: 'T' });
      const group = storage.createTaskGroup({ name: 'G', failurePolicy: 'STOP' });
      storage.addTaskGroupItem({ taskGroupId: group.id, taskId: task.id, order: 0 });
      const items = storage.listTaskGroupItems(group.id);
      expect(items).toHaveLength(1);
    });
  });

  describe('task runs', () => {
    it('creates and updates a task run', () => {
      const task = storage.createTask({ name: 'T' });
      const runId = storage.createTaskRun({ taskId: task.id });
      expect(runId).toBeDefined();
      storage.updateTaskRun(runId, { result: 'completed', endedAt: new Date().toISOString() });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/services/__tests__/storage.test.ts
```

Expected: FAIL — `storage.ts` doesn't exist.

- [ ] **Step 3: Implement StorageService**

Create `src/main/services/storage.ts` with all CRUD methods for tasks, steps, step groups, task groups, task group items, task runs, and task group runs. Use `uuid` for ID generation. Use `better-sqlite3` prepared statements.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/services/__tests__/storage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Refactor**

Extract any repeated SQL patterns. Ensure all methods use prepared statements.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/storage.ts src/main/services/__tests__/storage.test.ts
git commit -m "feat: StorageService with CRUD for tasks, steps, groups, runs"
```

---

## Task 4: Logger Service

**Files:**
- Create: `src/main/services/logger.ts`
- Create: `src/main/services/__tests__/logger.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/main/services/__tests__/logger.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger } from '../logger';

describe('Logger', () => {
  let logger: Logger;
  let mockIpc: any;

  beforeEach(() => {
    mockIpc = { send: vi.fn() };
    logger = new Logger('/tmp/test-logs', mockIpc);
  });

  it('logs at INFO level by default', () => {
    logger.info('TestEngine', 'hello');
    expect(mockIpc.send).toHaveBeenCalledWith('log:entry', expect.objectContaining({
      level: 'INFO',
      source: 'TestEngine',
      message: 'hello',
    }));
  });

  it('does not send DEBUG when debug is off', () => {
    logger.debug('TestEngine', 'debug msg');
    expect(mockIpc.send).not.toHaveBeenCalled();
  });

  it('sends DEBUG when debug is on', () => {
    logger.setDebug(true);
    logger.debug('TestEngine', 'debug msg');
    expect(mockIpc.send).toHaveBeenCalledWith('log:entry', expect.objectContaining({
      level: 'DEBUG',
    }));
  });

  it('toggles debug state', () => {
    logger.setDebug(true);
    expect(logger.isDebugEnabled()).toBe(true);
    logger.setDebug(false);
    expect(logger.isDebugEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/services/__tests__/logger.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement Logger**

Create `src/main/services/logger.ts` with methods: `info()`, `warn()`, `error()`, `debug()`, `setDebug()`, `isDebugEnabled()`. Each method formats as `[timestamp] [LEVEL] [source] message` and sends via IPC. DEBUG is filtered when debug mode is off. File writing can be added later.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/services/__tests__/logger.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/logger.ts src/main/services/__tests__/logger.test.ts
git commit -m "feat: Logger service with debug toggle and IPC output"
```

---

## Task 5: Python Port Allocation & Process Manager

**Files:**
- Create: `src/main/python/port.ts`
- Create: `src/main/python/manager.ts`
- Create: `src/main/python/__tests__/port.test.ts`
- Create: `src/main/python/__tests__/manager.test.ts`

- [ ] **Step 1: Write failing test for port allocation**

Create `src/main/python/__tests__/port.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findAvailablePort } from '../port';

describe('findAvailablePort', () => {
  it('returns a number', async () => {
    const port = await findAvailablePort();
    expect(typeof port).toBe('number');
    expect(port).toBeGreaterThan(0);
  });

  it('returns different ports on successive calls', async () => {
    const p1 = await findAvailablePort();
    const p2 = await findAvailablePort();
    // They might be the same if the first port is released quickly,
    // but typically should differ
    expect(p1).toBeGreaterThan(0);
    expect(p2).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/python/__tests__/port.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement port.ts**

Create `src/main/python/port.ts`:

```typescript
import { createServer } from 'net';

export function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (typeof address === 'object' && address) {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Could not determine port')));
      }
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/python/__tests__/port.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing test for Python manager**

Create `src/main/python/__tests__/manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PythonManager } from '../manager';

describe('PythonManager', () => {
  it('starts and reports health', async () => {
    // This test mocks the spawn; real integration tested manually
    const manager = new PythonManager('/fake/python', '/fake/service');
    expect(manager.isRunning()).toBe(false);
  });
});
```

- [ ] **Step 6: Implement manager.ts**

Create `src/main/python/manager.ts` with `start()`, `stop()`, `isRunning()`, `getPort()`, `health()` methods. Uses `child_process.spawn` to launch the Python Flask service. Includes health check polling and auto-restart on crash.

- [ ] **Step 7: Run all Python tests**

```bash
npx vitest run src/main/python/__tests__/
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/main/python/
git commit -m "feat: Python subprocess manager with port allocation"
```

---

## Task 6: Matcher Client & Capture Service

**Files:**
- Create: `src/main/services/matcher-client.ts`
- Create: `src/main/services/capture.ts`
- Create: `src/main/services/__tests__/matcher-client.test.ts`
- Create: `src/main/services/__tests__/capture.test.ts`

- [ ] **Step 1: Write failing test for matcher client**

Create `src/main/services/__tests__/matcher-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MatcherClient } from '../matcher-client';
import http from 'http';

describe('MatcherClient', () => {
  let server: http.Server;
  let client: MatcherClient;
  let port: number;

  beforeEach(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', version: '1.0', opencv_version: '4.8' }));
      } else if (req.url === '/match') {
        let body = '';
        req.on('data', (chunk) => body += chunk);
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 }));
        });
      }
    });
    await new Promise<void>(resolve => server.listen(0, () => resolve()));
    port = (server.address() as any).port;
    client = new MatcherClient(`http://localhost:${port}`);
  });

  afterEach(() => {
    server.close();
  });

  it('checks health', async () => {
    const result = await client.health();
    expect(result.status).toBe('ok');
  });

  it('sends match request', async () => {
    const result = await client.match({
      screenshot: 'base64abc',
      template: 'base64def',
      threshold: 0.8,
      scaleRange: [0.5, 2.0],
    });
    expect(result.matched).toBe(true);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/services/__tests__/matcher-client.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement MatcherClient**

Create `src/main/services/matcher-client.ts` with `health()`, `match()`, `matchGroup()` methods using Node.js `http` module to POST to the Python Flask service.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/services/__tests__/matcher-client.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing test for capture service**

Create `src/main/services/__tests__/capture.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { CaptureService } from '../capture';

describe('CaptureService', () => {
  it('captures screenshot from webContents', async () => {
    const mockWebContents = {
      capturePage: vi.fn().mockResolvedValue({
        toDataURL: () => 'data:image/png;base64,abc123',
      }),
    };
    const service = new CaptureService({ getWebContents: () => mockWebContents });
    const result = await service.capture();
    expect(result).toContain('data:image/png;base64');
    expect(mockWebContents.capturePage).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Implement CaptureService**

Create `src/main/services/capture.ts` with `capture()` and `captureRegion()` methods using `webContents.capturePage()`.

- [ ] **Step 7: Run capture test**

```bash
npx vitest run src/main/services/__tests__/capture.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/main/services/matcher-client.ts src/main/services/capture.ts src/main/services/__tests__/
git commit -m "feat: MatcherClient HTTP service and CaptureService"
```

---

## Task 7: Clicker Service

**Files:**
- Create: `src/main/services/clicker.ts`
- Create: `src/main/services/__tests__/clicker.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/main/services/__tests__/clicker.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ClickerService } from '../clicker';

describe('ClickerService', () => {
  it('sends mouse click event at coordinates', () => {
    const mockWebContents = {
      sendInputEvent: vi.fn(),
    };
    const service = new ClickerService({ getWebContents: () => mockWebContents });
    service.click(100, 200);
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseDown', x: 100, y: 200 })
    );
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseUp', x: 100, y: 200 })
    );
  });

  it('supports different mouse buttons', () => {
    const mockWebContents = { sendInputEvent: vi.fn() };
    const service = new ClickerService({ getWebContents: () => mockWebContents });
    service.click(50, 50, 'right');
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ button: 'right' })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/services/__tests__/clicker.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement ClickerService**

Create `src/main/services/clicker.ts` with `click(x, y, button?)` method that sends `mouseDown` + `mouseUp` input events via `webContents.sendInputEvent()`.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/services/__tests__/clicker.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/clicker.ts src/main/services/__tests__/clicker.test.ts
git commit -m "feat: ClickerService with webContents.sendInputEvent"
```

---

## Task 8: Task Engine

**Files:**
- Create: `src/main/services/task-engine.ts`
- Create: `src/main/services/__tests__/task-engine.test.ts`

- [ ] **Step 1: Write failing tests for task lifecycle**

Create `src/main/services/__tests__/task-engine.test.ts` with tests covering:
- Task starts with idle status
- Runs a task and completes on match
- Handles miss result
- Stops a running task
- Executes multiple steps in sequence
- Executes step group with loop count
- Stops infinite loop on END_GROUP_LOOP
- Checks interrupt handlers before each step
- Persists task run history
- Fails when Python service is unhealthy
- CLICK step uses captured coordinates

Use mocks for StorageService, CaptureService, MatcherClient, ClickerService.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/services/__tests__/task-engine.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement TaskEngine**

Create `src/main/services/task-engine.ts` with:
- `start(taskId)` — health check, create run, execute steps with branching
- `stop(taskId)` — set running flag to false
- `getStatus(taskId)` — return current status
- Step execution: capture → match → branch (onMatch/onMiss)
- Step group loop handling
- Interrupt handler pre-scan
- Step timeout and task global timeout
- Variable capture (match results → variable map)
- Run history persistence

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/services/__tests__/task-engine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Refactor**

Extract step execution into a private method. Ensure clean separation between match/click logic and flow control.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/task-engine.ts src/main/services/__tests__/task-engine.test.ts
git commit -m "feat: TaskEngine with branching, step groups, interrupts, timeouts"
```

---

## Task 9: Task Group Engine

**Files:**
- Create: `src/main/services/task-group-engine.ts`
- Create: `src/main/services/__tests__/task-group-engine.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/main/services/__tests__/task-group-engine.test.ts` with tests covering:
- Serial execution of tasks A, B, C
- Same task repeated in group
- STOP policy halts on failure
- SKIP policy continues on failure
- RETRY policy retries N times
- Stop interrupts execution
- Run history persistence

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/services/__tests__/task-group-engine.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement TaskGroupEngine**

Create `src/main/services/task-group-engine.ts` with:
- `start(taskGroupId)` — iterate items, apply failure policy
- `stop(taskGroupId)` — set running flag to false
- `executeWithPolicy()` — retry logic
- Run history logging

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/services/__tests__/task-group-engine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/task-group-engine.ts src/main/services/__tests__/task-group-engine.test.ts
git commit -m "feat: TaskGroupEngine with failure policies and run history"
```

---

## Task 10: IPC Handler Registry & Task IPC

**Files:**
- Create: `src/main/ipc/registry.ts`
- Create: `src/main/ipc/task.ts`
- Create: `src/main/ipc/__tests__/registry.test.ts`
- Create: `src/main/ipc/__tests__/task-ipc.test.ts`

- [ ] **Step 1: Write failing test for IPC registry**

Create `src/main/ipc/__tests__/registry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { IpcRegistry } from '../registry';

describe('IpcRegistry', () => {
  it('registers and invokes handlers', async () => {
    const mockIpcMain = {
      handle: vi.fn(),
    };
    const registry = new IpcRegistry(mockIpcMain as any);
    registry.handle('test:channel', async (_event, args) => {
      return { result: args.value * 2 };
    });
    expect(mockIpcMain.handle).toHaveBeenCalledWith('test:channel', expect.any(Function));
  });
});
```

- [ ] **Step 2: Run test, implement, run again**

Implement `IpcRegistry` class that wraps `ipcMain.handle()` with type safety and error handling.

- [ ] **Step 3: Write failing test for task IPC**

Create `src/main/ipc/__tests__/task-ipc.test.ts` with tests for task CRUD IPC handlers.

- [ ] **Step 4: Implement task IPC handlers**

Create `src/main/ipc/task.ts` registering handlers for all task-related IPC channels (create, list, get, update, delete, start, pause, stop).

- [ ] **Step 5: Run all IPC tests**

```bash
npx vitest run src/main/ipc/__tests__/
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/
git commit -m "feat: IPC registry and task CRUD handlers"
```

---

## Task 11: Remaining IPC Handlers

**Files:**
- Create: `src/main/ipc/task-group.ts`
- Create: `src/main/ipc/log.ts`
- Create: `src/main/ipc/network.ts`
- Create: `src/main/ipc/__tests__/task-group-ipc.test.ts`
- Create: `src/main/ipc/__tests__/log-ipc.test.ts`
- Create: `src/main/ipc/__tests__/network-ipc.test.ts`

- [ ] **Step 1: Write and implement task group IPC**

Handlers for: create, list, get, update, delete, add-item, remove-item, get-items, start, stop.

- [ ] **Step 2: Write and implement log IPC**

Handlers for: set-debug, get-logs, clear-display, export.

- [ ] **Step 3: Write and implement network IPC**

Handlers for: start, stop, get-logs, clear, export.

- [ ] **Step 4: Run all tests**

```bash
npx vitest run src/main/ipc/__tests__/
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/
git commit -m "feat: task group, log, and network IPC handlers"
```

---

## Task 12: Network Monitor

**Files:**
- Create: `src/main/services/network-monitor.ts`
- Create: `src/main/services/__tests__/network-monitor.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for: start/stop monitoring, request capture, response capture, large body file storage, log persistence.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/services/__tests__/network-monitor.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement NetworkMonitor**

Create `src/main/services/network-monitor.ts` using CDP `Network.enable`, `Network.requestWillBeSent`, `Network.responseReceived`, `Network.loadingFinished` events. Store logs via StorageService. Large bodies (>1MB) saved to files.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/services/__tests__/network-monitor.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/network-monitor.ts src/main/services/__tests__/network-monitor.test.ts
git commit -m "feat: CDP-based NetworkMonitor with log persistence"
```

---

## Task 13: Main Process Entry & Window

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/window.ts`
- Modify: `src/main/preload.ts`

- [ ] **Step 1: Write failing test for window creation**

Create `src/main/__tests__/window.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('window module', () => {
  it('exports createMainWindow function', async () => {
    const mod = await import('../window');
    expect(typeof mod.createMainWindow).toBe('function');
  });
});
```

- [ ] **Step 2: Implement window.ts**

Create BrowserWindow with:
- Size 1400x900
- `webviewTag: true` in webPreferences
- Preload script
- Load renderer URL in dev, file in production

- [ ] **Step 3: Implement preload.ts**

Expose `electronAPI` via contextBridge with:
- `invoke(channel, args)` — wraps ipcRenderer.invoke
- `on(channel, callback)` — wraps ipcRenderer.on
- `removeAllListeners(channel)` — wraps ipcRenderer.removeAllListeners

- [ ] **Step 4: Implement index.ts**

Wire up all services:
1. Create SQLite database
2. Run migrations
3. Create StorageService, Logger, CaptureService, ClickerService, MatcherClient, TaskEngine, TaskGroupEngine, NetworkMonitor
4. Start Python manager
5. Register all IPC handlers
6. Create main window

- [ ] **Step 5: Run all main process tests**

```bash
npx vitest run src/main/__tests__/ src/main/**/__tests__/
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts src/main/window.ts src/main/preload.ts
git commit -m "feat: main process entry with service wiring"
```

---

## Task 14: Zustand Stores

**Files:**
- Create: `src/renderer/stores/taskStore.ts`
- Create: `src/renderer/stores/logStore.ts`
- Create: `src/renderer/stores/networkStore.ts`
- Create: `src/renderer/__tests__/logStore.test.ts`

- [ ] **Step 1: Write failing test for logStore**

Create `src/renderer/__tests__/logStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useLogStore } from '../stores/logStore';

describe('logStore', () => {
  beforeEach(() => {
    useLogStore.setState({ logs: [], debugEnabled: false });
  });

  it('adds a log entry', () => {
    useLogStore.getState().addLog({
      timestamp: '2025-01-01T00:00:00Z',
      level: 'INFO',
      source: 'Test',
      message: 'hello',
    });
    expect(useLogStore.getState().logs).toHaveLength(1);
  });

  it('filters by level', () => {
    const { addLog } = useLogStore.getState();
    addLog({ timestamp: '1', level: 'INFO', source: 'T', message: 'a' });
    addLog({ timestamp: '2', level: 'ERROR', source: 'T', message: 'b' });
    useLogStore.setState({ levelFilter: 'ERROR' });
    const filtered = useLogStore.getState().filteredLogs();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].level).toBe('ERROR');
  });

  it('toggles debug', () => {
    useLogStore.getState().toggleDebug();
    expect(useLogStore.getState().debugEnabled).toBe(true);
  });

  it('clears logs', () => {
    useLogStore.getState().addLog({ timestamp: '1', level: 'INFO', source: 'T', message: 'a' });
    useLogStore.getState().clearLogs();
    expect(useLogStore.getState().logs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement all stores**

Create `taskStore.ts` with task list, selected task, steps, CRUD actions.
Create `logStore.ts` with logs array, filters, debug toggle, addLog/clearLogs.
Create `networkStore.ts` with logs array, filters, start/stop, addLog/clear.

- [ ] **Step 3: Run test to verify it passes**

```bash
npx vitest run src/renderer/__tests__/logStore.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stores/ src/renderer/__tests__/
git commit -m "feat: Zustand stores for tasks, logs, network"
```

---

## Task 15: Browser Panel Component

**Files:**
- Create: `src/renderer/components/Browser/BrowserPanel.tsx`

- [ ] **Step 1: Implement BrowserPanel**

Component with:
- URL input bar with navigate button
- Back, Forward, Refresh buttons
- `<webview>` tag for embedded browser
- IPC calls for navigation

- [ ] **Step 2: Verify manually**

Run `npm run dev` and verify browser panel loads a URL and navigation works.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Browser/
git commit -m "feat: BrowserPanel with webview and navigation controls"
```

---

## Task 16: Assistant Module - Task List & Editor

**Files:**
- Create: `src/renderer/components/Assistant/TaskList.tsx`
- Create: `src/renderer/components/Assistant/TaskEditor.tsx`
- Create: `src/renderer/components/Assistant/StepEditor.tsx`
- Create: `src/renderer/components/Assistant/ExecutionStatus.tsx`

- [ ] **Step 1: Implement TaskList**

Ant Design `<List>` with:
- Task name, status tag (colored)
- Play/Pause, Edit, Delete action buttons
- "New Task" button with name input modal
- Uses `useTaskStore` for state

- [ ] **Step 2: Implement TaskEditor**

Card with:
- Task name input, settings form (timeouts, retries)
- Interrupt handlers list with add/edit/delete
- Steps list showing type and template
- Inline StepEditor for adding/editing steps

- [ ] **Step 3: Implement StepEditor**

Form with:
- Step type selector (IMAGE_MATCH, IMAGE_GROUP, CLICK)
- Type-specific config fields
- onMatch / onMiss transition selectors
- Screenshot before match toggle

- [ ] **Step 4: Implement ExecutionStatus**

Card that appears when task is running:
- Current step indicator
- Real-time step results (MATCH/MISS tags)
- IPC event listeners for status updates

- [ ] **Step 5: Verify manually**

Run `npm run dev`, create a task, add steps, verify UI.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Assistant/
git commit -m "feat: TaskList, TaskEditor, StepEditor, ExecutionStatus components"
```

---

## Task 17: Assistant Module - Task Group UI

**Files:**
- Create: `src/renderer/components/Assistant/TaskGroupList.tsx`
- Create: `src/renderer/components/Assistant/TaskGroupEditor.tsx`

- [ ] **Step 1: Implement TaskGroupList**

List with:
- Group name, failure policy tag
- Start, Stop, Edit, Delete actions
- "New Group" modal with name + failure policy

- [ ] **Step 2: Implement TaskGroupEditor**

Card with:
- Name, failure policy form
- Tasks in group list with remove action
- "Add task" Select dropdown

- [ ] **Step 3: Verify manually**

Run `npm run dev`, create a group, add tasks, verify UI.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Assistant/TaskGroupList.tsx src/renderer/components/Assistant/TaskGroupEditor.tsx
git commit -m "feat: TaskGroupList and TaskGroupEditor components"
```

---

## Task 18: Tools Module

**Files:**
- Create: `src/renderer/components/Tools/LogViewer.tsx`
- Create: `src/renderer/components/Tools/ImageCompare.tsx`
- Create: `src/renderer/components/Tools/ClickTest.tsx`

- [ ] **Step 1: Implement LogViewer**

Table with:
- Real-time log display via IPC
- Level filter (ERROR/WARN/INFO/DEBUG)
- Source filter
- Text search
- Debug toggle
- Clear and Export buttons

- [ ] **Step 2: Implement ImageCompare**

Form with:
- Two Upload components (screenshot + template)
- "Compare" button
- Result display (matched, coordinates, confidence, scale)

- [ ] **Step 3: Implement ClickTest**

Form with:
- X, Y coordinate inputs
- Button selector (left/right/middle)
- Click count input
- "Click" button

- [ ] **Step 4: Verify manually**

Run `npm run dev`, test each tool.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Tools/
git commit -m "feat: LogViewer, ImageCompare, ClickTest tools"
```

---

## Task 19: Network Log UI

**Files:**
- Create: `src/renderer/components/Network/NetworkLog.tsx`

- [ ] **Step 1: Implement NetworkLog**

Table with:
- Start/Stop capture toggle
- Method filter, URL search filter
- Columns: method, URL, status, duration, size
- Clear and Export buttons
- Real-time updates via IPC

- [ ] **Step 2: Verify manually**

Run `npm run dev`, start capture, browse a page, verify logs appear.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Network/
git commit -m "feat: NetworkLog component with filters and export"
```

---

## Task 20: Root Layout (App.tsx)

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/main.tsx`
- Modify: `src/renderer/index.html`

- [ ] **Step 1: Implement App.tsx**

Root layout with:
- `<Splitter>` — left (70%) BrowserPanel, right (30%) Tabs
- Tab 1: Assistant (Tasks/Groups toggle + content)
- Tab 2: Tools (Log/Compare/Click sub-tabs)
- Tab 3: Network

- [ ] **Step 2: Implement main.tsx**

React entry with `createRoot` and `<App />`.

- [ ] **Step 3: Verify manually**

Run `npm run dev`, verify full layout with all tabs.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.tsx src/renderer/main.tsx src/renderer/index.html
git commit -m "feat: root layout with Splitter, Tabs, and all modules"
```

---

## Task 21: Python Image Matching Service

**Files:**
- Create: `python-service/main.py`
- Create: `python-service/matcher.py`
- Create: `python-service/config.py`
- Create: `python-service/requirements.txt`
- Create: `python-service/test_matcher.py`

- [ ] **Step 1: Write failing tests**

Create `python-service/test_matcher.py` with tests for:
- Single template match (successful)
- No match found
- Scaled match
- Group match with ALL logic
- Group match with ANY logic
- ROI match
- Scale cache

- [ ] **Step 2: Run test to verify it fails**

```bash
cd python-service && python -m pytest test_matcher.py -v
```

Expected: FAIL — `matcher.py` doesn't exist.

- [ ] **Step 3: Implement matcher.py**

Implement `match_template(img, template, threshold, scale_range)` with:
- Two-pass coarse-to-fine matching (0.25 step, then 0.05 refinement)
- Scale cache for faster subsequent matches
- ROI support

Implement `match_group(img, templates, logic, scale_range)` with ALL/ANY logic.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd python-service && python -m pytest test_matcher.py -v
```

Expected: PASS.

- [ ] **Step 5: Implement main.py**

Flask app with:
- `GET /health` — status, version, opencv_version
- `POST /match` — single template matching
- `POST /match-group` — group matching

- [ ] **Step 6: Implement config.py and requirements.txt**

Default parameters (threshold, scale range, cache size). Dependencies: opencv-python-headless, flask, numpy.

- [ ] **Step 7: Commit**

```bash
git add python-service/
git commit -m "feat: Python Flask image matching service with multi-scale support"
```

---

## Task 22: JSON Import/Export

**Files:**
- Create: `src/main/ipc/import-export.ts`
- Create: `src/main/ipc/__tests__/import-export.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for:
- Export tasks and groups as JSON
- Import tasks and groups from JSON
- Imported tasks have correct steps

- [ ] **Step 2: Implement import/export handlers**

Export: gather tasks + steps + groups → write JSON file.
Import: read JSON → create tasks + steps + groups in storage.

- [ ] **Step 3: Run test to verify it passes**

```bash
npx vitest run src/main/ipc/__tests__/import-export.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/import-export.ts src/main/ipc/__tests__/import-export.test.ts
git commit -m "feat: JSON import/export for tasks and task groups"
```

---

## Task 23: Config Service

**Files:**
- Create: `src/main/services/config.ts`
- Create: `src/main/services/__tests__/config.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for:
- Get/set data directory
- Get/set debug mode (persisted)
- Default values

- [ ] **Step 2: Implement ConfigService**

JSON file-based config in user data directory.

- [ ] **Step 3: Run test, commit**

```bash
npx vitest run src/main/services/__tests__/config.test.ts
git add src/main/services/config.ts src/main/services/__tests__/config.test.ts
git commit -m "feat: ConfigService with persisted settings"
```

---

## Task 24: Electron Builder & Packaging

**Files:**
- Modify: `electron-builder.yml`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Configure electron-builder.yml**

```yaml
appId: com.game-assistant.app
productName: Game Assistant
directories:
  output: release
files:
  - dist
  - out
extraResources:
  - from: bin/
    to: python-service
asar: true
win:
  target: nsis
  icon: resources/icon.ico
mac:
  target: dmg
  icon: resources/icon.icns
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

- [ ] **Step 2: Add build scripts to package.json**

```json
{
  "scripts": {
    "build:python": "cd python-service && pyinstaller matcher.spec --distpath ../bin --workpath ../build/pyinstaller --noconfirm",
    "package:win": "electron-builder --win",
    "package:mac": "electron-builder --mac"
  }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
npm run package:win
```

Verify the installer works.

- [ ] **Step 4: Commit**

```bash
git add electron-builder.yml package.json
git commit -m "feat: electron-builder configuration for Windows and macOS"
```

---

## Task 25: Log File Persistence & Rotation

**Files:**
- Modify: `src/main/services/logger.ts`
- Modify: `src/main/services/__tests__/logger.test.ts`

- [ ] **Step 1: Write failing tests for file rotation**

Tests for:
- Log file created with correct name pattern
- New file when date changes
- New file when size exceeds 10MB
- Auto-cleanup of files older than 30 days

- [ ] **Step 2: Implement file writing and rotation**

Add `fs.appendFile` to Logger. Track current file path. Check date change and size before each write. Implement cleanup on startup.

- [ ] **Step 3: Run test, commit**

```bash
npx vitest run src/main/services/__tests__/logger.test.ts
git add src/main/services/logger.ts src/main/services/__tests__/logger.test.ts
git commit -m "feat: log file persistence with day/size rotation and auto-cleanup"
```

---

## Task 26: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test:run
```

- [ ] **Step 2: Create release workflow**

Trigger on `v*.*.*` tag. Build Python → Build App → Create Release.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "ci: GitHub Actions for CI and cross-platform release"
```

---

## Task 27: Integration Verification

**Files:** None (manual testing)

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
cd python-service && python -m pytest -v
```

Expected: All PASS.

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Verify:
1. Browser loads a URL
2. Create a task with IMAGE_MATCH + CLICK steps
3. Create a task group with 2 tasks
4. Run the task group
5. Check log viewer shows entries
6. Check network monitor captures requests
7. Export/import tasks as JSON

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: integration verification complete"
```
