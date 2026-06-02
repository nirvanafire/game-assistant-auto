# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Electron + TypeScript + React project with SQLite persistence, logging system, and IPC infrastructure — everything needed before building features.

**Architecture:** Electron main process manages SQLite (better-sqlite3) and a file-based logger. React renderer communicates via IPC. Python subprocess manager is stubbed for now. All services are registered through a central IPC handler pattern.

**Tech Stack:** Electron, TypeScript, React, Vite (electron-vite), better-sqlite3, Ant Design, Vitest

---

## File Structure

```
game-assistant-auto/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
├── vitest.config.ts
├── src/
│   ├── main/
│   │   ├── index.ts                          # App entry, window creation
│   │   ├── window.ts                         # BrowserWindow management
│   │   ├── preload.ts                        # Preload script (contextBridge)
│   │   ├── db/
│   │   │   ├── schema.ts                     # CREATE TABLE statements
│   │   │   ├── migrations.ts                 # Version-based migration runner
│   │   │   └── __tests__/
│   │   │       ├── schema.test.ts
│   │   │       └── migrations.test.ts
│   │   ├── services/
│   │   │   ├── storage.ts                    # SQLite wrapper (CRUD helpers)
│   │   │   ├── logger.ts                     # File + IPC logger
│   │   │   └── __tests__/
│   │   │       ├── storage.test.ts
│   │   │       └── logger.test.ts
│   │   └── ipc/
│   │       ├── registry.ts                   # IPC handler registration
│   │       ├── task.ts                       # Task IPC handlers (stub)
│   │       ├── log.ts                        # Log IPC handlers
│   │       └── __tests__/
│   │           └── registry.test.ts
│   ├── renderer/
│   │   ├── main.tsx                          # React entry
│   │   ├── App.tsx                           # Root layout with splitter
│   │   ├── components/
│   │   │   └── Tools/
│   │   │       └── LogViewer.tsx             # Log viewer UI
│   │   ├── stores/
│   │   │   └── logStore.ts                   # Log state management
│   │   └── __tests__/
│   │       └── App.test.tsx
│   └── shared/
│       ├── types/
│       │   ├── task.ts                       # Task, Step, StepGroup types
│       │   ├── task-group.ts                 # TaskGroup types
│       │   ├── log.ts                        # Log entry types
│       │   └── match-result.ts               # MatchResult types
│       └── constants.ts                      # IPC channel names
├── data/                                     # Runtime (gitignored)
│   └── logs/
└── templates/                                # Template images (gitignored)
```

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Initialize npm project and install dependencies**

```bash
cd /c/Code/Learn/game-assistant-auto
npm init -y
npm install electron electron-vite react react-dom antd zustand better-sqlite3 uuid
npm install -D typescript @types/react @types/react-dom @types/better-sqlite3 @types/uuid vitest @testing-library/react @testing-library/jest-dom jsdom vite
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
data/
templates/
*.db
*.log
.DS_Store
```

- [ ] **Step 5: Verify project structure**

```bash
ls package.json tsconfig.json vite.config.ts .gitignore
```

Expected: All files exist.

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Electron + TypeScript + React project"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/shared/types/task.ts`
- Create: `src/shared/types/task-group.ts`
- Create: `src/shared/types/log.ts`
- Create: `src/shared/types/match-result.ts`
- Create: `src/shared/constants.ts`

- [ ] **Step 1: Write failing test for type exports**

Create `src/shared/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Task, Step, StepGroup, StepTransition, ImageMatchConfig, ClickConfig, ImageGroupMatchConfig } from '../types/task';
import type { TaskGroup, TaskGroupItem } from '../types/task-group';
import type { LogEntry, LogLevel, LogSource } from '../types/log';
import type { MatchResult } from '../types/match-result';
import { IPC_CHANNELS } from '../constants';

describe('shared types', () => {
  it('exports IPC channel constants', () => {
    expect(IPC_CHANNELS.TASK_CREATE).toBe('task:create');
    expect(IPC_CHANNELS.LOG_ENTRY).toBe('log:entry');
    expect(IPC_CHANNELS.TASK_GROUP_CREATE).toBe('task-group:create');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/__tests__/types.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create shared types**

Create `src/shared/types/task.ts`:

```typescript
export type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
export type StepType = 'IMAGE_MATCH' | 'IMAGE_GROUP' | 'CLICK';

export interface StepTransition {
  nextStepId?: string;
  action?: 'END_TASK' | 'END_GROUP_LOOP';
}

export interface ImageMatchConfig {
  templatePath: string;
  threshold: number;
  delayMs: number;
  retryCount: number;
  retryIntervalMs: number;
  scaleRange: [number, number];
  captureRegion?: { x: number; y: number; width: number; height: number };
}

export interface ImageGroupMatchConfig {
  templates: Array<{ label: string; templatePath: string; threshold: number }>;
  logic: 'ALL' | 'ANY';
  delayMs: number;
  retryCount: number;
  retryIntervalMs: number;
  scaleRange: [number, number];
}

export interface ClickConfig {
  source: 'fixed' | 'from_step';
  stepId?: string;
  fixedCoords?: { x: number; y: number };
  clickCount: number;
  intervalMs: number;
  delayMs: number;
  button: 'left' | 'right';
}

export interface Step {
  id: string;
  taskId: string;
  type: StepType;
  order: number;
  groupId?: string;
  config: ImageMatchConfig | ImageGroupMatchConfig | ClickConfig;
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

export interface InterruptHandler {
  id: string;
  label: string;
  templatePath: string;
  threshold: number;
  action: 'CLICK_AT_MATCH' | 'CLICK_FIXED' | 'SKIP';
  fixedCoords?: { x: number; y: number };
  priority: number;
}

export interface TaskSettings {
  screenshotBeforeMatch: boolean;
  maxRetries: number;
  globalTimeoutMs: number;
  stepTimeoutMs: number;
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

Create `src/shared/types/log.ts`:

```typescript
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
export type LogSource = 'TaskEngine' | 'Matcher' | 'Clicker' | 'Network' | 'Python' | 'Storage' | 'App';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
}
```

Create `src/shared/types/match-result.ts`:

```typescript
export interface MatchResult {
  matched: boolean;
  x?: number;
  y?: number;
  confidence: number;
  scale: number;
}

export interface GroupMatchResult {
  results: Array<MatchResult & { label: string }>;
}
```

Create `src/shared/constants.ts`:

```typescript
export const IPC_CHANNELS = {
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_START: 'task:start',
  TASK_PAUSE: 'task:pause',
  TASK_STOP: 'task:stop',
  TASK_DELETE: 'task:delete',
  TASK_STATUS_CHANGED: 'task:status-changed',
  TASK_STEP_RESULT: 'task:step-result',
  TASK_LOG: 'task:log',
  TASK_GROUP_CREATE: 'task-group:create',
  TASK_GROUP_UPDATE: 'task-group:update',
  TASK_GROUP_START: 'task-group:start',
  TASK_GROUP_STOP: 'task-group:stop',
  TASK_GROUP_DELETE: 'task-group:delete',
  TASK_GROUP_STATUS_CHANGED: 'task-group:status-changed',
  TASK_GROUP_LOG: 'task-group:log',
  NETWORK_REQUEST: 'network:request',
  CAPTURE_SCREENSHOT: 'capture:screenshot',
  CAPTURE_CLICK: 'capture:click',
  CAPTURE_UPDATED: 'capture:updated',
  LOG_ENTRY: 'log:entry',
  LOG_DEBUG_STATE: 'log:debug-state',
  LOG_SET_DEBUG: 'log:set-debug',
  LOG_GET_LOGS: 'log:get-logs',
  LOG_EXPORT: 'log:export',
  LOG_CLEAR_DISPLAY: 'log:clear-display',
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/__tests__/types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/
git commit -m "feat: add shared types and IPC channel constants"
```

---

## Task 3: SQLite Schema & Migrations

**Files:**
- Create: `src/main/db/schema.ts`
- Create: `src/main/db/migrations.ts`
- Create: `src/main/db/__tests__/schema.test.ts`
- Create: `src/main/db/__tests__/migrations.test.ts`

- [ ] **Step 1: Write failing test for schema creation**

Create `src/main/db/__tests__/schema.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../schema';

describe('createSchema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('creates all required tables', () => {
    createSchema(db);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const tableNames = tables.map((t: any) => t.name);

    expect(tableNames).toContain('tasks');
    expect(tableNames).toContain('steps');
    expect(tableNames).toContain('step_groups');
    expect(tableNames).toContain('task_groups');
    expect(tableNames).toContain('task_group_items');
    expect(tableNames).toContain('task_runs');
    expect(tableNames).toContain('task_group_runs');
    expect(tableNames).toContain('network_logs');
    expect(tableNames).toContain('schema_version');
  });

  it('creates indexes', () => {
    createSchema(db);

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all();
    const indexNames = indexes.map((i: any) => i.name);

    expect(indexNames).toContain('idx_steps_task');
    expect(indexNames).toContain('idx_steps_group');
    expect(indexNames).toContain('idx_task_runs_task');
    expect(indexNames).toContain('idx_task_group_items_group');
    expect(indexNames).toContain('idx_task_group_runs_group');
    expect(indexNames).toContain('idx_network_logs_ts');
  });

  it('enables WAL mode', () => {
    createSchema(db);

    const mode = db.pragma('journal_mode', { simple: true });
    expect(mode).toBe('wal');
  });

  it('enables foreign keys', () => {
    createSchema(db);

    const fk = db.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);
  });

  it('inserts initial schema version', () => {
    createSchema(db);

    const version = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as any;
    expect(version.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/db/__tests__/schema.test.ts
```

Expected: FAIL — `createSchema` not found.

- [ ] **Step 3: Write schema implementation**

Create `src/main/db/schema.ts`:

```typescript
import Database from 'better-sqlite3';

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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, getCurrentVersion } from '../migrations';
import { createSchema } from '../schema';

describe('runMigrations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns current version when no migrations needed', () => {
    const version = runMigrations(db);
    expect(version).toBe(1);
  });

  it('getCurrentVersion returns schema version', () => {
    expect(getCurrentVersion(db)).toBe(1);
  });

  it('runs migration v2 when available', () => {
    // Simulate adding a migration
    const migrations = [
      {
        version: 2,
        up: (db: Database.Database) => {
          db.exec('ALTER TABLE tasks ADD COLUMN tags JSON DEFAULT "[]"');
        },
      },
    ];

    const version = runMigrations(db, migrations);
    expect(version).toBe(2);
    expect(getCurrentVersion(db)).toBe(2);
  });

  it('skips already-applied migrations', () => {
    const migrations = [
      {
        version: 2,
        up: (db: Database.Database) => {
          db.exec('ALTER TABLE tasks ADD COLUMN tags JSON DEFAULT "[]"');
        },
      },
    ];

    runMigrations(db, migrations);
    const version = runMigrations(db, migrations);
    expect(version).toBe(2);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx vitest run src/main/db/__tests__/migrations.test.ts
```

Expected: FAIL — `runMigrations` not found.

- [ ] **Step 7: Write migrations implementation**

Create `src/main/db/migrations.ts`:

```typescript
import Database from 'better-sqlite3';

export interface Migration {
  version: number;
  up: (db: Database.Database) => void;
}

const builtInMigrations: Migration[] = [];

export function getCurrentVersion(db: Database.Database): number {
  const row = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as any;
  return row ? row.version : 0;
}

export function runMigrations(db: Database.Database, additionalMigrations: Migration[] = []): number {
  const allMigrations = [...builtInMigrations, ...additionalMigrations].sort((a, b) => a.version - b.version);
  const currentVersion = getCurrentVersion(db);

  for (const migration of allMigrations) {
    if (migration.version > currentVersion) {
      migration.up(db);
      db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(migration.version);
    }
  }

  return getCurrentVersion(db);
}
```

- [ ] **Step 8: Run all DB tests**

```bash
npx vitest run src/main/db/
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/main/db/
git commit -m "feat: add SQLite schema creation and migration system"
```

---

## Task 4: Storage Service

**Files:**
- Create: `src/main/services/storage.ts`
- Create: `src/main/services/__tests__/storage.test.ts`

- [ ] **Step 1: Write failing test for task CRUD**

Create `src/main/services/__tests__/storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
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

  afterEach(() => {
    db.close();
  });

  describe('tasks', () => {
    it('creates a task', () => {
      const task = storage.createTask({ name: 'Test Task' });
      expect(task.id).toBeDefined();
      expect(task.name).toBe('Test Task');
      expect(task.status).toBe('idle');
    });

    it('gets a task by id', () => {
      const created = storage.createTask({ name: 'Test Task' });
      const found = storage.getTask(created.id);
      expect(found?.name).toBe('Test Task');
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
      const updated = storage.getTask(task.id);
      expect(updated?.name).toBe('New Name');
    });

    it('deletes a task', () => {
      const task = storage.createTask({ name: 'To Delete' });
      storage.deleteTask(task.id);
      expect(storage.getTask(task.id)).toBeUndefined();
    });
  });

  describe('steps', () => {
    it('creates a step', () => {
      const task = storage.createTask({ name: 'Task' });
      const step = storage.createStep({
        taskId: task.id,
        type: 'IMAGE_MATCH',
        order: 1,
        config: { templatePath: '/path/to/img.png', threshold: 0.8, delayMs: 0, retryCount: 3, retryIntervalMs: 1000, scaleRange: [0.5, 2.0] },
        onMatch: {},
        onMiss: {},
        screenshotBeforeMatch: false,
      });
      expect(step.id).toBeDefined();
      expect(step.type).toBe('IMAGE_MATCH');
    });

    it('lists steps for a task', () => {
      const task = storage.createTask({ name: 'Task' });
      storage.createStep({ taskId: task.id, type: 'IMAGE_MATCH', order: 1, config: { templatePath: '', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: {}, onMiss: {}, screenshotBeforeMatch: false });
      storage.createStep({ taskId: task.id, type: 'CLICK', order: 2, config: { source: 'fixed', fixedCoords: { x: 100, y: 200 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, onMatch: {}, onMiss: {}, screenshotBeforeMatch: false });
      const steps = storage.listSteps(task.id);
      expect(steps).toHaveLength(2);
    });
  });

  describe('task groups', () => {
    it('creates a task group', () => {
      const group = storage.createTaskGroup({ name: 'Daily Tasks', failurePolicy: 'STOP' });
      expect(group.id).toBeDefined();
      expect(group.name).toBe('Daily Tasks');
      expect(group.failurePolicy).toBe('STOP');
    });

    it('adds items to a task group', () => {
      const task = storage.createTask({ name: 'Task A' });
      const group = storage.createTaskGroup({ name: 'Group', failurePolicy: 'STOP' });
      storage.addTaskGroupItem(group.id, task.id, 1);
      const items = storage.listTaskGroupItems(group.id);
      expect(items).toHaveLength(1);
      expect(items[0].taskId).toBe(task.id);
    });

    it('allows same task multiple times in a group', () => {
      const task = storage.createTask({ name: 'Task A' });
      const group = storage.createTaskGroup({ name: 'Group', failurePolicy: 'STOP' });
      storage.addTaskGroupItem(group.id, task.id, 1);
      storage.addTaskGroupItem(group.id, task.id, 2);
      const items = storage.listTaskGroupItems(group.id);
      expect(items).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/services/__tests__/storage.test.ts
```

Expected: FAIL — `StorageService` not found.

- [ ] **Step 3: Write storage implementation**

Create `src/main/services/storage.ts`:

```typescript
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Task, Step, StepGroup } from '@shared/types/task';
import type { TaskGroup, TaskGroupItem } from '@shared/types/task-group';

export class StorageService {
  constructor(private db: Database.Database) {}

  createTask(data: { name: string; settings?: any; interruptHandlers?: any[] }): Task {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO tasks (id, name, status, settings, interrupt_handlers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, data.name, 'idle', JSON.stringify(data.settings || {}), JSON.stringify(data.interruptHandlers || []), now, now);
    return this.getTask(id)!;
  }

  getTask(id: string): Task | undefined {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      settings: JSON.parse(row.settings),
      interruptHandlers: JSON.parse(row.interrupt_handlers),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listTasks(): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      settings: JSON.parse(row.settings),
      interruptHandlers: JSON.parse(row.interrupt_handlers),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  updateTask(id: string, data: Partial<{ name: string; status: string; settings: any; interruptHandlers: any[] }>): void {
    const now = new Date().toISOString();
    if (data.name !== undefined) {
      this.db.prepare('UPDATE tasks SET name = ?, updated_at = ? WHERE id = ?').run(data.name, now, id);
    }
    if (data.status !== undefined) {
      this.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(data.status, now, id);
    }
    if (data.settings !== undefined) {
      this.db.prepare('UPDATE tasks SET settings = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(data.settings), now, id);
    }
    if (data.interruptHandlers !== undefined) {
      this.db.prepare('UPDATE tasks SET interrupt_handlers = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(data.interruptHandlers), now, id);
    }
  }

  deleteTask(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }

  createStep(data: Omit<Step, 'id'>): Step {
    const id = uuidv4();
    this.db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", group_id, config, on_match, on_miss, screenshot_before_match) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, data.taskId, data.type, data.order, data.groupId || null, JSON.stringify(data.config), JSON.stringify(data.onMatch), JSON.stringify(data.onMiss), data.screenshotBeforeMatch ? 1 : 0);
    return { ...data, id };
  }

  listSteps(taskId: string): Step[] {
    const rows = this.db.prepare('SELECT * FROM steps WHERE task_id = ? ORDER BY "order"').all(taskId) as any[];
    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      type: row.type,
      order: row.order,
      groupId: row.group_id,
      config: JSON.parse(row.config),
      onMatch: JSON.parse(row.on_match),
      onMiss: JSON.parse(row.on_miss),
      screenshotBeforeMatch: row.screenshot_before_match === 1,
    }));
  }

  createTaskGroup(data: { name: string; failurePolicy: string; retryCount?: number }): TaskGroup {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO task_groups (id, name, failure_policy, retry_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, data.name, data.failurePolicy, data.retryCount || 0, now, now);
    return { id, name: data.name, failurePolicy: data.failurePolicy as any, retryCount: data.retryCount || 0, createdAt: now, updatedAt: now };
  }

  getTaskGroup(id: string): TaskGroup | undefined {
    const row = this.db.prepare('SELECT * FROM task_groups WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return { id: row.id, name: row.name, failurePolicy: row.failure_policy, retryCount: row.retry_count, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  listTaskGroups(): TaskGroup[] {
    const rows = this.db.prepare('SELECT * FROM task_groups ORDER BY created_at DESC').all() as any[];
    return rows.map(row => ({ id: row.id, name: row.name, failurePolicy: row.failure_policy, retryCount: row.retry_count, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  addTaskGroupItem(taskGroupId: string, taskId: string, order: number): TaskGroupItem {
    const id = uuidv4();
    this.db.prepare('INSERT INTO task_group_items (id, task_group_id, task_id, "order") VALUES (?, ?, ?, ?)').run(id, taskGroupId, taskId, order);
    return { id, taskGroupId, taskId, order };
  }

  listTaskGroupItems(taskGroupId: string): TaskGroupItem[] {
    const rows = this.db.prepare('SELECT * FROM task_group_items WHERE task_group_id = ? ORDER BY "order"').all(taskGroupId) as any[];
    return rows.map(row => ({ id: row.id, taskGroupId: row.task_group_id, taskId: row.task_id, order: row.order }));
  }

  deleteTaskGroupItem(id: string): void {
    this.db.prepare('DELETE FROM task_group_items WHERE id = ?').run(id);
  }

  deleteTaskGroup(id: string): void {
    this.db.prepare('DELETE FROM task_groups WHERE id = ?').run(id);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/services/__tests__/storage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/storage.ts src/main/services/__tests__/storage.test.ts
git commit -m "feat: add StorageService with task, step, and task group CRUD"
```

---

## Task 5: Logger Service

**Files:**
- Create: `src/main/services/logger.ts`
- Create: `src/main/services/__tests__/logger.test.ts`

- [ ] **Step 1: Write failing test for logger**

Create `src/main/services/__tests__/logger.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';

describe('Logger', () => {
  const testLogDir = path.join(__dirname, '__test_logs__');

  beforeEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true });
    }
  });

  it('creates log file on first write', () => {
    const logger = new Logger(testLogDir, false);
    logger.info('App', 'test message');

    const files = fs.readdirSync(testLogDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/game-assistant-.*\.log/);
  });

  it('writes INFO log in correct format', () => {
    const logger = new Logger(testLogDir, false);
    logger.info('TaskEngine', 'task started');

    const content = fs.readdirSync(testLogDir);
    const logFile = path.join(testLogDir, content[0]);
    const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n');

    expect(lines[0]).toMatch(/\[.*\] \[INFO\] \[TaskEngine\] task started/);
  });

  it('does not write DEBUG logs when debug is off', () => {
    const logger = new Logger(testLogDir, false);
    logger.debug('Matcher', 'scale=1.25');

    const files = fs.readdirSync(testLogDir);
    if (files.length === 0) return; // No file created = correct behavior
    const logFile = path.join(testLogDir, files[0]);
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).not.toContain('DEBUG');
  });

  it('writes DEBUG logs when debug is on', () => {
    const logger = new Logger(testLogDir, true);
    logger.debug('Matcher', 'scale=1.25');

    const files = fs.readdirSync(testLogDir);
    expect(files.length).toBe(1);
    const logFile = path.join(testLogDir, files[0]);
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toContain('[DEBUG]');
    expect(content).toContain('[Matcher]');
  });

  it('rotates file when size exceeds 10MB', () => {
    const logger = new Logger(testLogDir, false, 1024); // 1KB for testing
    logger.info('App', 'x'.repeat(2000)); // Exceed 1KB

    const files = fs.readdirSync(testLogDir);
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it('toggles debug mode', () => {
    const logger = new Logger(testLogDir, false);
    logger.setDebug(true);
    logger.debug('App', 'debug message');

    const files = fs.readdirSync(testLogDir);
    const logFile = path.join(testLogDir, files[0]);
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toContain('debug message');
  });

  it('returns debug state', () => {
    const logger = new Logger(testLogDir, false);
    expect(logger.isDebugEnabled()).toBe(false);
    logger.setDebug(true);
    expect(logger.isDebugEnabled()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/services/__tests__/logger.test.ts
```

Expected: FAIL — `Logger` not found.

- [ ] **Step 3: Write logger implementation**

Create `src/main/services/logger.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import type { LogLevel, LogSource, LogEntry } from '@shared/types/log';

export class Logger {
  private logDir: string;
  private debugEnabled: boolean;
  private maxFileSize: number;
  private currentDate: string = '';
  private currentFileIndex: number = 0;
  private currentStream: fs.WriteStream | null = null;
  private onLogEntry?: (entry: LogEntry) => void;

  constructor(logDir: string, debugEnabled: boolean, maxFileSize: number = 10 * 1024 * 1024) {
    this.logDir = logDir;
    this.debugEnabled = debugEnabled;
    this.maxFileSize = maxFileSize;
    fs.mkdirSync(logDir, { recursive: true });
  }

  setOnLogEntry(callback: (entry: LogEntry) => void): void {
    this.onLogEntry = callback;
  }

  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  isDebugEnabled(): boolean {
    return this.debugEnabled;
  }

  error(source: LogSource, message: string): void {
    this.log('ERROR', source, message);
  }

  warn(source: LogSource, message: string): void {
    this.log('WARN', source, message);
  }

  info(source: LogSource, message: string): void {
    this.log('INFO', source, message);
  }

  debug(source: LogSource, message: string): void {
    if (!this.debugEnabled) return;
    this.log('DEBUG', source, message);
  }

  private log(level: LogLevel, source: LogSource, message: string): void {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 23);
    const line = `[${timestamp}] [${level}] [${source}] ${message}\n`;

    this.ensureStream(now);
    this.currentStream?.write(line);

    this.onLogEntry?.({ timestamp: now.toISOString(), level, source, message });
  }

  private ensureStream(now: Date): void {
    const dateStr = now.toISOString().substring(0, 10);

    if (dateStr !== this.currentDate) {
      this.currentDate = dateStr;
      this.currentFileIndex = 0;
      this.rotateStream();
      return;
    }

    const stats = this.currentStream ? fs.statSync(this.getCurrentPath()) : null;
    if (stats && stats.size >= this.maxFileSize) {
      this.currentFileIndex++;
      this.rotateStream();
    }
  }

  private getCurrentPath(): string {
    const suffix = this.currentFileIndex === 0 ? '' : `.${this.currentFileIndex}`;
    return path.join(this.logDir, `game-assistant-${this.currentDate}${suffix}.log`);
  }

  private rotateStream(): void {
    this.currentStream?.end();
    this.currentStream = fs.createWriteStream(this.getCurrentPath(), { flags: 'a' });
  }

  cleanup(maxAgeDays: number): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    const files = fs.readdirSync(this.logDir);
    for (const file of files) {
      const match = file.match(/game-assistant-(\d{4}-\d{2}-\d{2})/);
      if (match) {
        const fileDate = new Date(match[1]);
        if (fileDate < cutoff) {
          fs.unlinkSync(path.join(this.logDir, file));
        }
      }
    }
  }

  destroy(): void {
    this.currentStream?.end();
    this.currentStream = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/services/__tests__/logger.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/logger.ts src/main/services/__tests__/logger.test.ts
git commit -m "feat: add Logger with file rotation, debug toggle, and auto-cleanup"
```

---

## Task 6: IPC Registry

**Files:**
- Create: `src/main/ipc/registry.ts`
- Create: `src/main/ipc/__tests__/registry.test.ts`

- [ ] **Step 1: Write failing test for IPC registry**

Create `src/main/ipc/__tests__/registry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { IpcRegistry } from '../registry';

describe('IpcRegistry', () => {
  it('registers and calls a handler', () => {
    const registry = new IpcRegistry();
    const handler = vi.fn().mockReturnValue('result');
    registry.handle('test:channel', handler);

    // Simulate calling the handler
    const registeredHandler = registry.getHandler('test:channel');
    expect(registeredHandler).toBeDefined();
  });

  it('throws on duplicate registration', () => {
    const registry = new IpcRegistry();
    registry.handle('test:channel', vi.fn());
    expect(() => registry.handle('test:channel', vi.fn())).toThrow('already registered');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/ipc/__tests__/registry.test.ts
```

Expected: FAIL — `IpcRegistry` not found.

- [ ] **Step 3: Write IPC registry implementation**

Create `src/main/ipc/registry.ts`:

```typescript
import { ipcMain } from 'electron';

type IpcHandler = (event: any, ...args: any[]) => any;

export class IpcRegistry {
  private handlers = new Map<string, IpcHandler>();

  handle(channel: string, handler: IpcHandler): void {
    if (this.handlers.has(channel)) {
      throw new Error(`IPC handler already registered for channel: ${channel}`);
    }
    this.handlers.set(channel, handler);
    ipcMain.handle(channel, handler);
  }

  getHandler(channel: string): IpcHandler | undefined {
    return this.handlers.get(channel);
  }

  removeAll(): void {
    for (const channel of this.handlers.keys()) {
      ipcMain.removeHandler(channel);
    }
    this.handlers.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/ipc/__tests__/registry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/registry.ts src/main/ipc/__tests__/registry.test.ts
git commit -m "feat: add IPC handler registry with duplicate protection"
```

---

## Task 7: Log IPC Handlers

**Files:**
- Create: `src/main/ipc/log.ts`
- Create: `src/main/ipc/__tests__/log-ipc.test.ts`

- [ ] **Step 1: Write failing test for log IPC**

Create `src/main/ipc/__tests__/log-ipc.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogIpcHandlers } from '../log';

describe('Log IPC Handlers', () => {
  it('registers handlers for log channels', () => {
    const registry = { handle: vi.fn() } as any;
    const logger = { setDebug: vi.fn(), isDebugEnabled: vi.fn() } as any;
    const webContents = { send: vi.fn() } as any;

    createLogIpcHandlers(registry, logger, webContents);

    expect(registry.handle).toHaveBeenCalledWith('log:set-debug', expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith('log:get-logs', expect.any(Function));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/ipc/__tests__/log-ipc.test.ts
```

Expected: FAIL — `createLogIpcHandlers` not found.

- [ ] **Step 3: Write log IPC implementation**

Create `src/main/ipc/log.ts`:

```typescript
import type { IpcRegistry } from './registry';
import type { Logger } from '../services/logger';

export function createLogIpcHandlers(
  registry: IpcRegistry,
  logger: Logger,
  webContents: Electron.WebContents
): void {
  logger.setOnLogEntry((entry) => {
    webContents.send('log:entry', entry);
  });

  registry.handle('log:set-debug', (_event, data: { enabled: boolean }) => {
    logger.setDebug(data.enabled);
    webContents.send('log:debug-state', { enabled: data.enabled });
    return { success: true };
  });

  registry.handle('log:get-logs', (_event, _filters) => {
    return { logs: [] };
  });

  registry.handle('log:export', (_event, _data) => {
    return { success: true };
  });

  registry.handle('log:clear-display', () => {
    return { success: true };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/ipc/__tests__/log-ipc.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/log.ts src/main/ipc/__tests__/log-ipc.test.ts
git commit -m "feat: add log IPC handlers for debug toggle and log streaming"
```

---

## Task 8: Log Viewer UI Component

**Files:**
- Create: `src/renderer/components/Tools/LogViewer.tsx`
- Create: `src/renderer/stores/logStore.ts`
- Create: `src/renderer/__tests__/LogViewer.test.tsx`

- [ ] **Step 1: Write failing test for log store**

Create `src/renderer/__tests__/logStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useLogStore } from '../stores/logStore';

describe('useLogStore', () => {
  beforeEach(() => {
    useLogStore.setState({ logs: [], debugEnabled: false, levelFilter: null, sourceFilter: null, searchText: '' });
  });

  it('adds a log entry', () => {
    const { addLog } = useLogStore.getState();
    addLog({ timestamp: '2025-01-01T00:00:00.000Z', level: 'INFO', source: 'App', message: 'hello' });

    const { logs } = useLogStore.getState();
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe('hello');
  });

  it('filters by level', () => {
    const { addLog, setLevelFilter } = useLogStore.getState();
    addLog({ timestamp: '2025-01-01T00:00:00.000Z', level: 'INFO', source: 'App', message: 'info' });
    addLog({ timestamp: '2025-01-01T00:00:01.000Z', level: 'ERROR', source: 'App', message: 'error' });
    setLevelFilter('ERROR');

    const { filteredLogs } = useLogStore.getState();
    expect(filteredLogs).toHaveLength(1);
    expect(filteredLogs[0].message).toBe('error');
  });

  it('filters by search text', () => {
    const { addLog, setSearchText } = useLogStore.getState();
    addLog({ timestamp: '2025-01-01T00:00:00.000Z', level: 'INFO', source: 'App', message: 'task started' });
    addLog({ timestamp: '2025-01-01T00:00:01.000Z', level: 'INFO', source: 'App', message: 'match found' });
    setSearchText('task');

    const { filteredLogs } = useLogStore.getState();
    expect(filteredLogs).toHaveLength(1);
    expect(filteredLogs[0].message).toBe('task started');
  });

  it('clears logs', () => {
    const { addLog, clearLogs } = useLogStore.getState();
    addLog({ timestamp: '2025-01-01T00:00:00.000Z', level: 'INFO', source: 'App', message: 'hello' });
    clearLogs();

    expect(useLogStore.getState().logs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/renderer/__tests__/logStore.test.ts
```

Expected: FAIL — `useLogStore` not found.

- [ ] **Step 3: Write log store**

Create `src/renderer/stores/logStore.ts`:

```typescript
import { create } from 'zustand';
import type { LogEntry, LogLevel, LogSource } from '@shared/types/log';

interface LogState {
  logs: LogEntry[];
  debugEnabled: boolean;
  levelFilter: LogLevel | null;
  sourceFilter: LogSource | null;
  searchText: string;
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  setDebug: (enabled: boolean) => void;
  setLevelFilter: (level: LogLevel | null) => void;
  setSourceFilter: (source: LogSource | null) => void;
  setSearchText: (text: string) => void;
  filteredLogs: LogEntry[];
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  debugEnabled: false,
  levelFilter: null,
  sourceFilter: null,
  searchText: '',
  filteredLogs: [],
  addLog: (entry) => set((state) => {
    const logs = [...state.logs, entry];
    return { logs, filteredLogs: filterLogs(logs, state) };
  }),
  clearLogs: () => set({ logs: [], filteredLogs: [] }),
  setDebug: (enabled) => set({ debugEnabled: enabled }),
  setLevelFilter: (level) => set((state) => ({ levelFilter: level, filteredLogs: filterLogs(state.logs, { ...state, levelFilter: level }) })),
  setSourceFilter: (source) => set((state) => ({ sourceFilter: source, filteredLogs: filterLogs(state.logs, { ...state, sourceFilter: source }) })),
  setSearchText: (text) => set((state) => ({ searchText: text, filteredLogs: filterLogs(state.logs, { ...state, searchText: text }) })),
}));

function filterLogs(logs: LogEntry[], state: { levelFilter: LogLevel | null; sourceFilter: LogSource | null; searchText: string }): LogEntry[] {
  return logs.filter((log) => {
    if (state.levelFilter && log.level !== state.levelFilter) return false;
    if (state.sourceFilter && log.source !== state.sourceFilter) return false;
    if (state.searchText && !log.message.toLowerCase().includes(state.searchText.toLowerCase())) return false;
    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/renderer/__tests__/logStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write LogViewer component**

Create `src/renderer/components/Tools/LogViewer.tsx`:

```tsx
import React from 'react';
import { Input, Select, Button, Table, Space, Switch } from 'antd';
import { useLogStore } from '../../stores/logStore';
import type { LogLevel, LogSource } from '@shared/types/log';

const LOG_LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
const LOG_SOURCES: LogSource[] = ['TaskEngine', 'Matcher', 'Clicker', 'Network', 'Python', 'Storage', 'App'];

export const LogViewer: React.FC = () => {
  const { filteredLogs, debugEnabled, levelFilter, sourceFilter, searchText, setDebug, setLevelFilter, setSourceFilter, setSearchText, clearLogs } = useLogStore();

  const columns = [
    { title: 'Time', dataIndex: 'timestamp', key: 'timestamp', width: 100, render: (ts: string) => ts.substring(11, 19) },
    { title: 'Level', dataIndex: 'level', key: 'level', width: 80 },
    { title: 'Source', dataIndex: 'source', key: 'source', width: 100 },
    { title: 'Message', dataIndex: 'message', key: 'message' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Space style={{ padding: 8, flexWrap: 'wrap' }}>
        <Switch checked={debugEnabled} onChange={setDebug} checkedChildren="DEBUG" unCheckedChildren="DEBUG" />
        <Select placeholder="Level" allowClear style={{ width: 100 }} value={levelFilter} onChange={setLevelFilter} options={LOG_LEVELS.map(l => ({ label: l, value: l }))} />
        <Select placeholder="Source" allowClear style={{ width: 120 }} value={sourceFilter} onChange={setSourceFilter} options={LOG_SOURCES.map(s => ({ label: s, value: s }))} />
        <Input.Search placeholder="Search" style={{ width: 200 }} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
        <Button onClick={clearLogs}>Clear</Button>
      </Space>
      <Table dataSource={filteredLogs} columns={columns} size="small" pagination={false} scroll={{ y: 'calc(100vh - 300px)' }} rowKey={(_, i) => String(i)} />
    </div>
  );
};
```

- [ ] **Step 6: Run all renderer tests**

```bash
npx vitest run src/renderer/__tests__/
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Tools/LogViewer.tsx src/renderer/stores/logStore.ts src/renderer/__tests__/
git commit -m "feat: add LogViewer component and log state store"
```

---

## Task 9: App Entry & Main Window

**Files:**
- Create: `src/main/index.ts`
- Create: `src/main/window.ts`
- Create: `src/main/preload.ts`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`

- [ ] **Step 1: Create preload script**

Create `src/main/preload.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
```

- [ ] **Step 2: Create window manager**

Create `src/main/window.ts`:

```typescript
import { BrowserWindow } from 'electron';
import path from 'path';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_DEV) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}
```

- [ ] **Step 3: Create app entry**

Create `src/main/index.ts`:

```typescript
import { app } from 'electron';
import { createMainWindow } from './window';
import { createSchema } from './db/schema';
import { runMigrations } from './db/migrations';
import { StorageService } from './services/storage';
import { Logger } from './services/logger';
import { IpcRegistry } from './ipc/registry';
import { createLogIpcHandlers } from './ipc/log';
import Database from 'better-sqlite3';
import path from 'path';

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'data', 'game-assistant.db');
const logDir = path.join(userDataPath, 'data', 'logs');

let db: Database.Database;
let storage: StorageService;
let logger: Logger;
let registry: IpcRegistry;

app.whenReady().then(() => {
  db = new Database(dbPath);
  createSchema(db);
  runMigrations(db);

  storage = new StorageService(db);
  logger = new Logger(logDir, false);
  logger.cleanup(30);

  registry = new IpcRegistry();
  const win = createMainWindow();

  createLogIpcHandlers(registry, logger, win.webContents);
});

app.on('window-all-closed', () => {
  logger.destroy();
  db?.close();
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 4: Create React entry**

Create `src/renderer/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/renderer/App.tsx`:

```tsx
import React from 'react';
import { Tabs, Splitter } from 'antd';
import { LogViewer } from './components/Tools/LogViewer';

export const App: React.FC = () => {
  return (
    <Splitter style={{ height: '100vh' }}>
      <Splitter.Panel defaultSize="50%" min="30%">
        <div style={{ padding: 16 }}>
          <h2>Browser</h2>
          <p>Embedded browser will be here</p>
        </div>
      </Splitter.Panel>
      <Splitter.Panel>
        <Tabs defaultActiveKey="assistant" items={[
          { key: 'assistant', label: 'Assistant', children: <div>Task list will be here</div> },
          { key: 'tools', label: 'Tools', children: <Tabs defaultActiveKey="log" items={[
            { key: 'log', label: 'Log', children: <LogViewer /> },
            { key: 'compare', label: 'Image Compare', children: <div>Image compare tool</div> },
            { key: 'click', label: 'Click Test', children: <div>Click test tool</div> },
          ]} /> },
          { key: 'network', label: 'Network', children: <div>Network monitor will be here</div> },
        ]} />
      </Splitter.Panel>
    </Splitter>
  );
};
```

- [ ] **Step 5: Create index.html**

Create `src/renderer/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Game Assistant</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/main/index.ts src/main/window.ts src/main/preload.ts src/renderer/
git commit -m "feat: add app entry, main window, and React root layout"
```

---

## Task 10: Electron-Builder Configuration

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json`

- [ ] **Step 1: Create electron-builder config**

Create `electron-builder.yml`:

```yaml
appId: com.game-assistant.auto
productName: Game Assistant
directories:
  output: dist
files:
  - "**/*"
extraResources:
  - from: "bin/"
    to: "python-service"
    filter:
      - "**/*"

win:
  target:
    - target: nsis
      arch: [x64]
  icon: resources/icon.ico

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  icon: resources/icon.icns

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

- [ ] **Step 2: Update package.json scripts**

Read current `package.json` and add scripts:

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "package:win": "electron-builder --win",
    "package:mac": "electron-builder --mac"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add electron-builder.yml package.json
git commit -m "feat: add electron-builder configuration for Windows and macOS"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - SQLite storage (persistence spec) → Tasks 3, 4
   - Schema migrations (persistence spec) → Task 3
   - Storage location (persistence spec) → Task 9 (userDataPath)
   - WAL mode (persistence spec) → Task 3
   - Log levels (logging spec) → Task 5
   - Global debug toggle (logging spec) → Tasks 5, 7
   - Dual output (logging spec) → Tasks 5, 7
   - File rotation by day/size (logging spec) → Task 5
   - Log file naming (logging spec) → Task 5
   - Auto-cleanup (logging spec) → Task 5
   - Log format (logging spec) → Task 5
   - Log sources (logging spec) → Task 5

2. **Placeholder scan:** No TBD/TODO found. All steps have code.

3. **Type consistency:** Types defined in Task 2 are used consistently in Tasks 3-8.
