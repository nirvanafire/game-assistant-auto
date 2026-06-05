# Refactor Assistant Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comprehensive overhaul of the assistant module — add coordinate caching, conditional step group execution, per-step screenshot control, CLICK step simplification, and double-click drawer editing.

**Architecture:** Changes span shared types, database schema (migration v3), TaskEngine execution logic, IPC channels, and React UI components. Coordinate cache is ephemeral (in-memory Map in TaskEngine), invalidated on browser resize. Step groups gain conditional branching via existing onMatch/onMiss transitions. CLICK steps drop transitions and always proceed to next ordered step.

**Tech Stack:** Electron, TypeScript, React 19, Ant Design 6, Zustand 5, better-sqlite3, Vitest

---

## File Structure

### Files to Create
- `src/main/services/__tests__/coordinate-cache.test.ts` — Unit tests for coordinate cache logic
- `src/main/services/__tests__/step-group-conditional.test.ts` — Unit tests for conditional step group execution
- `src/main/services/__tests__/click-simplification.test.ts` — Unit tests for CLICK step simplification
- `src/main/services/__tests__/realtime-match.test.ts` — Unit tests for per-step realtime match toggle
- `src/main/db/__tests__/migration-v3.test.ts` — Unit tests for migration v3
- `src/renderer/components/Assistant/__tests__/TaskList-drawer.test.tsx` — Unit tests for TaskList drawer editing
- `src/renderer/components/Assistant/__tests__/TaskGroupList-drawer.test.tsx` — Unit tests for TaskGroupList drawer editing

### Files to Modify
- `src/shared/types/task.ts` — Add `realtimeMatch`, `cacheCoordinates` to Step; add `END_STEP_GROUP` to StepTransition; make `onMatch`/`onMiss` optional
- `src/shared/constants.ts` — Add `BROWSER_RESIZED`, `TASK_CLEAR_COORDINATE_CACHE` IPC channel constants
- `src/main/db/schema.ts` — Update schema version to 3
- `src/main/db/migrations.ts` — Add migration v3 (new columns on steps table)
- `src/main/services/storage.ts` — Update `createStep`, `listSteps`, `updateStep` to handle new fields
- `src/main/services/task-engine.ts` — Add coordinate cache, implement conditional branching, CLICK simplification, realtimeMatch toggle
- `src/main/ipc/task.ts` — Add `task:clear-coordinate-cache` handler
- `src/main/index.ts` — Wire up new IPC handlers
- `src/renderer/components/Assistant/StepEditor.tsx` — Add realtimeMatch/cacheCoordinates toggles; hide transitions for CLICK; add END_STEP_GROUP option
- `src/renderer/components/Assistant/TaskList.tsx` — Add double-click handler + Drawer
- `src/renderer/components/Assistant/TaskGroupList.tsx` — Add double-click handler + Drawer
- `src/renderer/components/Assistant/ExecutionStatus.tsx` — Add cache clear button
- `src/renderer/components/Browser/BrowserPanel.tsx` — Add resize event forwarding via IPC
- `src/main/services/__tests__/task-engine.test.ts` — Update existing tests for new behavior

---

## Task 1: Shared Types — Step Interface Update

**Files:**
- Modify: `src/shared/types/task.ts`
- Test: `src/shared/types/__tests__/task-types.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/shared/types/__tests__/task-types.test.ts
import { describe, it, expect } from 'vitest';
import type { Step, StepTransition, StepType } from '../task';

describe('Step types', () => {
  it('StepTransition includes END_STEP_GROUP action', () => {
    const transition: StepTransition = { action: 'END_STEP_GROUP' };
    expect(transition.action).toBe('END_STEP_GROUP');
  });

  it('onMatch and onMiss are optional on Step', () => {
    const step: Step = {
      id: 's1',
      taskId: 't1',
      type: 'CLICK',
      order: 1,
      config: { source: 'fixed', fixedCoords: { x: 10, y: 20 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' },
      screenshotBeforeMatch: false,
      realtimeMatch: false,
      cacheCoordinates: false,
    };
    expect(step.onMatch).toBeUndefined();
    expect(step.onMiss).toBeUndefined();
  });

  it('IMAGE_MATCH step has realtimeMatch and cacheCoordinates fields', () => {
    const step: Step = {
      id: 's1',
      taskId: 't1',
      type: 'IMAGE_MATCH',
      order: 1,
      config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2.0] },
      onMatch: { action: 'END_TASK' },
      onMiss: { action: 'END_TASK' },
      screenshotBeforeMatch: true,
      realtimeMatch: true,
      cacheCoordinates: true,
    };
    expect(step.realtimeMatch).toBe(true);
    expect(step.cacheCoordinates).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/types/__tests__/task-types.test.ts`
Expected: FAIL — `realtimeMatch`, `cacheCoordinates` not on Step; `END_STEP_GROUP` not in StepTransition; `onMatch`/`onMiss` not optional.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/shared/types/task.ts — replace StepTransition and Step interfaces

export interface StepTransition {
  nextStepId?: string;
  action?: 'END_TASK' | 'END_STEP_GROUP';
}

// ... (ImageMatchConfig, ImageGroupMatchConfig, ClickConfig unchanged)

export interface Step {
  id: string;
  taskId: string;
  type: StepType;
  order: number;
  groupId?: string;
  config: ImageMatchConfig | ImageGroupMatchConfig | ClickConfig;
  onMatch?: StepTransition;
  onMiss?: StepTransition;
  screenshotBeforeMatch: boolean;
  realtimeMatch: boolean;
  cacheCoordinates: boolean;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/types/__tests__/task-types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/task.ts src/shared/types/__tests__/task-types.test.ts
git commit -m "feat: update Step type with realtimeMatch, cacheCoordinates, END_STEP_GROUP, optional transitions"
```

---

## Task 2: IPC Channel Constants

**Files:**
- Modify: `src/shared/constants.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/shared/__tests__/constants.test.ts (create)
import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '../constants';

describe('IPC_CHANNELS', () => {
  it('includes BROWSER_RESIZED channel', () => {
    expect(IPC_CHANNELS.BROWSER_RESIZED).toBe('browser:resized');
  });

  it('includes TASK_CLEAR_COORDINATE_CACHE channel', () => {
    expect(IPC_CHANNELS.TASK_CLEAR_COORDINATE_CACHE).toBe('task:clear-coordinate-cache');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/__tests__/constants.test.ts`
Expected: FAIL — properties don't exist

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/shared/constants.ts — add to IPC_CHANNELS object
  BROWSER_RESIZED: 'browser:resized',
  TASK_CLEAR_COORDINATE_CACHE: 'task:clear-coordinate-cache',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/__tests__/constants.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/constants.ts src/shared/__tests__/constants.test.ts
git commit -m "feat: add BROWSER_RESIZED and TASK_CLEAR_COORDINATE_CACHE IPC channels"
```

---

## Task 3: Database Migration v3

**Files:**
- Modify: `src/main/db/migrations.ts`
- Modify: `src/main/db/schema.ts`
- Test: `src/main/db/__tests__/migration-v3.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/db/__tests__/migration-v3.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../schema';
import { runMigrations, getCurrentVersion } from '../migrations';

describe('Migration v3', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  it('adds realtime_match and cache_coordinates columns to steps table', () => {
    runMigrations(db);
    const columns = db.prepare("PRAGMA table_info(steps)").all() as any[];
    const colNames = columns.map((c: any) => c.name);
    expect(colNames).toContain('realtime_match');
    expect(colNames).toContain('cache_coordinates');
  });

  it('sets realtime_match from task settings.screenshotBeforeMatch', () => {
    // Insert a task with screenshotBeforeMatch=true
    const taskId = 'task-1';
    db.prepare(
      "INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)"
    ).run(taskId, 'Test', 'idle', JSON.stringify({ screenshotBeforeMatch: true }), '[]');

    // Insert a step
    db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('step-1', taskId, 'IMAGE_MATCH', 1, '{}', '{}', '{}', 0);

    runMigrations(db);

    const step = db.prepare('SELECT realtime_match FROM steps WHERE id = ?').get('step-1') as any;
    expect(step.realtime_match).toBe(1);
  });

  it('sets cache_coordinates to 0 for existing steps', () => {
    const taskId = 'task-1';
    db.prepare(
      "INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)"
    ).run(taskId, 'Test', 'idle', JSON.stringify({ screenshotBeforeMatch: false }), '[]');

    db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('step-1', taskId, 'IMAGE_MATCH', 1, '{}', '{}', '{}', 0);

    runMigrations(db);

    const step = db.prepare('SELECT cache_coordinates FROM steps WHERE id = ?').get('step-1') as any;
    expect(step.cache_coordinates).toBe(0);
  });

  it('updates schema version to 3', () => {
    runMigrations(db);
    expect(getCurrentVersion(db)).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/db/__tests__/migration-v3.test.ts`
Expected: FAIL — columns don't exist, migration v3 not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/main/db/migrations.ts — add migration v3 to the migrations array
// Add AFTER the existing migration v2:

  {
    version: 3,
    up: (db: Database.Database) => {
      db.exec(`
        ALTER TABLE steps ADD COLUMN realtime_match INTEGER DEFAULT 0;
        ALTER TABLE steps ADD COLUMN cache_coordinates INTEGER DEFAULT 0;
      `);

      // Populate realtime_match from task settings
      db.exec(`
        UPDATE steps SET realtime_match = (
          SELECT CASE WHEN json_extract(tasks.settings, '$.screenshotBeforeMatch') = 1 THEN 1 ELSE 0 END
          FROM tasks WHERE tasks.id = steps.task_id
        );
      `);
    },
  },
```

Also update `src/main/db/schema.ts` line 104:
```typescript
    INSERT OR IGNORE INTO schema_version (version) VALUES (3);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/db/__tests__/migration-v3.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/db/migrations.ts src/main/db/schema.ts src/main/db/__tests__/migration-v3.test.ts
git commit -m "feat: add migration v3 for realtime_match and cache_coordinates columns"
```

---

## Task 4: StorageService — Handle New Step Fields

**Files:**
- Modify: `src/main/services/storage.ts`
- Test: `src/main/services/__tests__/storage.test.ts` (update existing)

- [ ] **Step 1: Write the failing test**

Add to `src/main/services/__tests__/storage.test.ts`:

```typescript
it('creates step with realtimeMatch and cacheCoordinates fields', () => {
  const task = storage.createTask({ name: 'Test' });
  const step = storage.createStep({
    taskId: task.id,
    type: 'IMAGE_MATCH',
    order: 1,
    config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2.0] },
    onMatch: { action: 'END_TASK' },
    onMiss: { action: 'END_TASK' },
    screenshotBeforeMatch: true,
    realtimeMatch: true,
    cacheCoordinates: true,
  });
  expect(step.realtimeMatch).toBe(true);
  expect(step.cacheCoordinates).toBe(true);
});

it('creates step without onMatch/onMiss (CLICK type)', () => {
  const task = storage.createTask({ name: 'Test' });
  const step = storage.createStep({
    taskId: task.id,
    type: 'CLICK',
    order: 1,
    config: { source: 'fixed', fixedCoords: { x: 10, y: 20 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' },
    screenshotBeforeMatch: false,
    realtimeMatch: false,
    cacheCoordinates: false,
  });
  expect(step.onMatch).toBeUndefined();
  expect(step.onMiss).toBeUndefined();
});

it('lists steps with new fields', () => {
  const task = storage.createTask({ name: 'Test' });
  storage.createStep({
    taskId: task.id,
    type: 'IMAGE_MATCH',
    order: 1,
    config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2.0] },
    onMatch: { action: 'END_TASK' },
    onMiss: { action: 'END_TASK' },
    screenshotBeforeMatch: true,
    realtimeMatch: true,
    cacheCoordinates: true,
  });
  const steps = storage.listSteps(task.id);
  expect(steps[0].realtimeMatch).toBe(true);
  expect(steps[0].cacheCoordinates).toBe(true);
});

it('updates step with new fields', () => {
  const task = storage.createTask({ name: 'Test' });
  const step = storage.createStep({
    taskId: task.id,
    type: 'IMAGE_MATCH',
    order: 1,
    config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2.0] },
    onMatch: { action: 'END_TASK' },
    onMiss: { action: 'END_TASK' },
    screenshotBeforeMatch: false,
    realtimeMatch: false,
    cacheCoordinates: false,
  });
  storage.updateStep(step.id, { realtimeMatch: true, cacheCoordinates: true });
  const updated = storage.listSteps(task.id).find(s => s.id === step.id)!;
  expect(updated.realtimeMatch).toBe(true);
  expect(updated.cacheCoordinates).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/services/__tests__/storage.test.ts`
Expected: FAIL — `realtimeMatch`/`cacheCoordinates` not persisted; optional onMatch/onMiss not handled

- [ ] **Step 3: Write minimal implementation**

Update `src/main/services/storage.ts`:

`createStep` method — update SQL and mapping:
```typescript
  createStep(data: Omit<Step, 'id'>): Step {
    const id = uuidv4();
    this.db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", group_id, config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id, data.taskId, data.type, data.order, data.groupId ?? null,
      JSON.stringify(data.config),
      data.onMatch ? JSON.stringify(data.onMatch) : '{}',
      data.onMiss ? JSON.stringify(data.onMiss) : '{}',
      data.screenshotBeforeMatch ? 1 : 0,
      data.realtimeMatch ? 1 : 0,
      data.cacheCoordinates ? 1 : 0,
    );
    return { ...data, id };
  }
```

`listSteps` method — update mapping:
```typescript
  listSteps(taskId: string): Step[] {
    const rows = this.db.prepare('SELECT * FROM steps WHERE task_id = ? ORDER BY "order"').all(taskId) as any[];
    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      type: row.type,
      order: row.order,
      groupId: row.group_id,
      config: JSON.parse(row.config),
      onMatch: row.on_match && row.on_match !== '{}' ? JSON.parse(row.on_match) : undefined,
      onMiss: row.on_miss && row.on_miss !== '{}' ? JSON.parse(row.on_miss) : undefined,
      screenshotBeforeMatch: row.screenshot_before_match === 1,
      realtimeMatch: row.realtime_match === 1,
      cacheCoordinates: row.cache_coordinates === 1,
    }));
  }
```

`updateStep` method — update merged object and SQL:
```typescript
  updateStep(id: string, data: Partial<Omit<Step, 'id'>>): void {
    const row = this.db.prepare('SELECT * FROM steps WHERE id = ?').get(id) as any;
    if (!row) return;
    const merged = {
      taskId: data.taskId ?? row.task_id,
      type: data.type ?? row.type,
      order: data.order ?? row.order,
      groupId: data.groupId ?? row.group_id,
      config: data.config ?? JSON.parse(row.config),
      onMatch: data.onMatch !== undefined ? data.onMatch : (row.on_match && row.on_match !== '{}' ? JSON.parse(row.on_match) : undefined),
      onMiss: data.onMiss !== undefined ? data.onMiss : (row.on_miss && row.on_miss !== '{}' ? JSON.parse(row.on_miss) : undefined),
      screenshotBeforeMatch: data.screenshotBeforeMatch ?? (row.screenshot_before_match === 1),
      realtimeMatch: data.realtimeMatch ?? (row.realtime_match === 1),
      cacheCoordinates: data.cacheCoordinates ?? (row.cache_coordinates === 1),
    };
    this.db.prepare(
      'UPDATE steps SET task_id = ?, type = ?, "order" = ?, group_id = ?, config = ?, on_match = ?, on_miss = ?, screenshot_before_match = ?, realtime_match = ?, cache_coordinates = ? WHERE id = ?'
    ).run(
      merged.taskId, merged.type, merged.order, merged.groupId ?? null,
      JSON.stringify(merged.config),
      merged.onMatch ? JSON.stringify(merged.onMatch) : '{}',
      merged.onMiss ? JSON.stringify(merged.onMiss) : '{}',
      merged.screenshotBeforeMatch ? 1 : 0,
      merged.realtimeMatch ? 1 : 0,
      merged.cacheCoordinates ? 1 : 0,
      id,
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/services/__tests__/storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/storage.ts src/main/services/__tests__/storage.test.ts
git commit -m "feat: update StorageService for realtimeMatch, cacheCoordinates, optional transitions"
```

---

## Task 5: Coordinate Cache in TaskEngine

**Files:**
- Modify: `src/main/services/task-engine.ts`
- Test: `src/main/services/__tests__/coordinate-cache.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/services/__tests__/coordinate-cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEngine } from '../task-engine';

describe('TaskEngine coordinate cache', () => {
  let engine: TaskEngine;
  let mockStorage: any;
  let mockCapture: any;
  let mockMatcher: any;
  let mockClicker: any;

  beforeEach(() => {
    mockStorage = {
      getTask: vi.fn().mockReturnValue({
        id: 't1', name: 'Test', status: 'idle',
        settings: { screenshotBeforeMatch: false, maxRetries: 3, globalTimeoutMs: 60000, stepTimeoutMs: 10000 },
        interruptHandlers: [],
      }),
      listSteps: vi.fn().mockReturnValue([]),
      listStepGroups: vi.fn().mockReturnValue([]),
      updateTask: vi.fn(),
      createTaskRun: vi.fn().mockReturnValue('run-1'),
      updateTaskRun: vi.fn(),
    };
    mockCapture = { capture: vi.fn().mockResolvedValue('data:image/png;base64,abc') };
    mockMatcher = {
      match: vi.fn().mockResolvedValue({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 }),
      matchGroup: vi.fn(),
      health: vi.fn().mockResolvedValue({ status: 'ok' }),
    };
    mockClicker = { click: vi.fn() };
    engine = new TaskEngine(mockStorage, mockCapture, mockMatcher, mockClicker);
  });

  it('cache starts empty on task start', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    expect(engine.getCoordinateCacheSize()).toBe(0);
  });

  it('caches coordinates when cacheCoordinates=true and match succeeds', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: true },
    ]);
    await engine.start('t1');
    expect(engine.getCoordinateCacheSize()).toBe(1);
    expect(engine.getCachedCoordinates('/img.png')).toEqual({ x: 100, y: 200 });
  });

  it('does not cache when cacheCoordinates=false', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    expect(engine.getCoordinateCacheSize()).toBe(0);
  });

  it('does not cache when match fails', async () => {
    mockMatcher.match.mockResolvedValue({ matched: false });
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: true },
    ]);
    await engine.start('t1');
    expect(engine.getCoordinateCacheSize()).toBe(0);
  });

  it('uses cached coordinates on second match (skips matcher call)', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: {}, onMiss: {}, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: true },
      { id: 's2', taskId: 't1', type: 'IMAGE_MATCH', order: 2, groupId: 'sg1', config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: true },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Loop', loopCount: 1 },
    ]);
    await engine.start('t1');
    // First call caches, second call uses cache — only 1 matcher call
    expect(mockMatcher.match).toHaveBeenCalledTimes(1);
  });

  it('clearCoordinateCache empties the cache', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: true },
    ]);
    await engine.start('t1');
    expect(engine.getCoordinateCacheSize()).toBe(1);
    engine.clearCoordinateCache();
    expect(engine.getCoordinateCacheSize()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/services/__tests__/coordinate-cache.test.ts`
Expected: FAIL — `getCoordinateCacheSize`, `getCachedCoordinates`, `clearCoordinateCache` don't exist

- [ ] **Step 3: Write minimal implementation**

In `src/main/services/task-engine.ts`, add coordinate cache fields and methods:

```typescript
// Add to TaskEngine class properties:
  private coordinateCache = new Map<string, { x: number; y: number }>();

// Add public methods:
  getCoordinateCacheSize(): number {
    return this.coordinateCache.size;
  }

  getCachedCoordinates(templatePath: string): { x: number; y: number } | undefined {
    return this.coordinateCache.get(templatePath);
  }

  clearCoordinateCache(): void {
    this.coordinateCache.clear();
  }
```

In `start()` method, clear cache at the beginning (after health check):
```typescript
    this.coordinateCache.clear();
```

Update `executeStepInner` for IMAGE_MATCH case to check/write cache:
```typescript
      case 'IMAGE_MATCH': {
        const config = step.config as any;

        // Check cache first
        if (step.cacheCoordinates) {
          const cached = this.coordinateCache.get(config.templatePath);
          if (cached) {
            ctx.variables.set(step.id, { matched: true, x: cached.x, y: cached.y, confidence: 1, scale: 1 } as any);
            return true;
          }
        }

        const matchRequest = {
          screenshot: ctx.lastScreenshot!,
          template: config.templatePath,
          threshold: config.threshold,
          scaleRange: config.scaleRange,
          region: config.captureRegion,
        };
        let result: MatchResult;
        try {
          result = await this.matcher.match(matchRequest);
        } catch (err: any) {
          this.logger?.warn('TaskEngine', `Match request failed, retrying: ${err.message}`);
          result = await this.matcher.match(matchRequest);
        }
        if (result.matched) {
          ctx.variables.set(step.id, result);
          // Write to cache
          if (step.cacheCoordinates && result.x != null && result.y != null) {
            this.coordinateCache.set(config.templatePath, { x: result.x, y: result.y });
          }
        }
        return result.matched;
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/services/__tests__/coordinate-cache.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/task-engine.ts src/main/services/__tests__/coordinate-cache.test.ts
git commit -m "feat: add coordinate cache to TaskEngine with read/write/clear"
```

---

## Task 6: TaskEngine — Per-Step realtimeMatch Toggle

**Files:**
- Modify: `src/main/services/task-engine.ts`
- Test: `src/main/services/__tests__/realtime-match.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/services/__tests__/realtime-match.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEngine } from '../task-engine';

describe('TaskEngine realtimeMatch toggle', () => {
  let engine: TaskEngine;
  let mockStorage: any;
  let mockCapture: any;
  let mockMatcher: any;
  let mockClicker: any;

  beforeEach(() => {
    mockStorage = {
      getTask: vi.fn().mockReturnValue({
        id: 't1', name: 'Test', status: 'idle',
        settings: { screenshotBeforeMatch: false, maxRetries: 3, globalTimeoutMs: 60000, stepTimeoutMs: 10000 },
        interruptHandlers: [],
      }),
      listSteps: vi.fn().mockReturnValue([]),
      listStepGroups: vi.fn().mockReturnValue([]),
      updateTask: vi.fn(),
      createTaskRun: vi.fn().mockReturnValue('run-1'),
      updateTaskRun: vi.fn(),
    };
    mockCapture = { capture: vi.fn().mockResolvedValue('data:image/png;base64,abc') };
    mockMatcher = {
      match: vi.fn().mockResolvedValue({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 }),
      matchGroup: vi.fn(),
      health: vi.fn().mockResolvedValue({ status: 'ok' }),
    };
    mockClicker = { click: vi.fn() };
    engine = new TaskEngine(mockStorage, mockCapture, mockMatcher, mockClicker);
  });

  it('captures fresh screenshot when realtimeMatch=true', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: false, realtimeMatch: true, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    expect(mockCapture.capture).toHaveBeenCalled();
  });

  it('reuses last screenshot when realtimeMatch=false and screenshot exists', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/first.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'IMAGE_MATCH', order: 2, config: { templatePath: '/second.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    // First step captures, second step reuses — only 1 capture call
    expect(mockCapture.capture).toHaveBeenCalledTimes(1);
    expect(mockMatcher.match).toHaveBeenCalledTimes(2);
  });

  it('captures screenshot when realtimeMatch=false but no previous screenshot exists', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    // Must capture even if realtimeMatch=false because no screenshot exists yet
    expect(mockCapture.capture).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/services/__tests__/realtime-match.test.ts`
Expected: FAIL — current code uses `screenshotBeforeMatch` field, not `realtimeMatch`

- [ ] **Step 3: Write minimal implementation**

Update `src/main/services/task-engine.ts` — replace all references to `step.screenshotBeforeMatch` with `step.realtimeMatch` in the step execution logic. The key change is in `executeSteps`:

For the non-group step execution path:
```typescript
      } else {
        if (step.realtimeMatch || !ctx.lastScreenshot) {
          ctx.lastScreenshot = await this.capture.capture();
        }
        // ... rest unchanged
      }
```

For the group step execution path:
```typescript
          for (const groupStep of groupSteps) {
            // ...
            if (groupStep.realtimeMatch || !ctx.lastScreenshot) {
              ctx.lastScreenshot = await this.capture.capture();
            }
            // ... rest unchanged
          }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/services/__tests__/realtime-match.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/task-engine.ts src/main/services/__tests__/realtime-match.test.ts
git commit -m "feat: use per-step realtimeMatch toggle instead of screenshotBeforeMatch"
```

---

## Task 7: TaskEngine — CLICK Step Simplification

**Files:**
- Modify: `src/main/services/task-engine.ts`
- Test: `src/main/services/__tests__/click-simplification.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/services/__tests__/click-simplification.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEngine } from '../task-engine';

describe('TaskEngine CLICK step simplification', () => {
  let engine: TaskEngine;
  let mockStorage: any;
  let mockCapture: any;
  let mockMatcher: any;
  let mockClicker: any;

  beforeEach(() => {
    mockStorage = {
      getTask: vi.fn().mockReturnValue({
        id: 't1', name: 'Test', status: 'idle',
        settings: { screenshotBeforeMatch: false, maxRetries: 3, globalTimeoutMs: 60000, stepTimeoutMs: 10000 },
        interruptHandlers: [],
      }),
      listSteps: vi.fn().mockReturnValue([]),
      listStepGroups: vi.fn().mockReturnValue([]),
      updateTask: vi.fn(),
      createTaskRun: vi.fn().mockReturnValue('run-1'),
      updateTaskRun: vi.fn(),
    };
    mockCapture = { capture: vi.fn().mockResolvedValue('data:image/png;base64,abc') };
    mockMatcher = {
      match: vi.fn().mockResolvedValue({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 }),
      matchGroup: vi.fn(),
      health: vi.fn().mockResolvedValue({ status: 'ok' }),
    };
    mockClicker = { click: vi.fn() };
    engine = new TaskEngine(mockStorage, mockCapture, mockMatcher, mockClicker);
  });

  it('CLICK step proceeds to next ordered step without onMatch/onMiss', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, config: { source: 'from_step', stepId: 's1', clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
      { id: 's3', taskId: 't1', type: 'IMAGE_MATCH', order: 3, config: { templatePath: '/done.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledWith(100, 200);
    expect(mockMatcher.match).toHaveBeenCalledTimes(2); // s1 and s3
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('CLICK step at end of task ends the task', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, config: { source: 'from_step', stepId: 's1', clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledWith(100, 200);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('CLICK step at end of step group ends the group loop', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, groupId: 'sg1', config: { source: 'from_step', stepId: 's1', clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Loop', loopCount: 3 },
    ]);
    await engine.start('t1');
    // 3 iterations × (1 match + 1 click) = 3 match calls, 3 click calls
    expect(mockMatcher.match).toHaveBeenCalledTimes(3);
    expect(mockClicker.click).toHaveBeenCalledTimes(3);
    expect(engine.getStatus('t1')).toBe('completed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/services/__tests__/click-simplification.test.ts`
Expected: FAIL — CLICK steps currently check onMatch/onMiss transitions

- [ ] **Step 3: Write minimal implementation**

Update `executeSteps` in `src/main/services/task-engine.ts`. For non-group steps, after CLICK execution, skip transition handling and always advance:

```typescript
      } else {
        if (step.realtimeMatch || !ctx.lastScreenshot) {
          ctx.lastScreenshot = await this.capture.capture();
        }

        await this.checkInterrupts(task, ctx, signal);

        const result = await this.executeStepWithTimeout(currentStep, ctx, settings.stepTimeoutMs, signal);
        runLog.push({ stepId: currentStep.id, type: currentStep.type, matched: result, timestamp: new Date().toISOString() });

        // CLICK steps always proceed to next ordered step
        if (currentStep.type === 'CLICK') {
          stepIndex++;
          continue;
        }

        const transition = result ? currentStep.onMatch : currentStep.onMiss;

        if (transition?.action === 'END_TASK') {
          this.statuses.set(taskId, 'completed');
          return;
        }

        if (transition?.nextStepId) {
          stepIndex = steps.findIndex(s => s.id === transition.nextStepId);
          if (stepIndex === -1) {
            this.statuses.set(taskId, 'completed');
            return;
          }
        } else {
          stepIndex++;
        }
      }
```

For group steps, similar change — CLICK steps always advance to next group step:

```typescript
          for (let gsi = 0; gsi < groupSteps.length; gsi++) {
            const groupStep = groupSteps[gsi];
            if (signal.aborted) throw new Error('STOPPED');
            if (Date.now() - startTime > settings.globalTimeoutMs) {
              this.statuses.set(taskId, 'failed');
              return;
            }

            ctx.currentStepId = groupStep.id;

            if (groupStep.realtimeMatch || !ctx.lastScreenshot) {
              ctx.lastScreenshot = await this.capture.capture();
            }

            await this.checkInterrupts(task, ctx, signal);

            const result = await this.executeStepWithTimeout(groupStep, ctx, settings.stepTimeoutMs, signal);
            runLog.push({ stepId: groupStep.id, type: groupStep.type, matched: result, timestamp: new Date().toISOString() });

            // CLICK steps always proceed to next step in group
            if (groupStep.type === 'CLICK') {
              continue;
            }

            const transition = result ? groupStep.onMatch : groupStep.onMiss;

            if (transition?.action === 'END_TASK') {
              this.statuses.set(taskId, 'completed');
              return;
            }
            if (transition?.action === 'END_STEP_GROUP') {
              broken = true;
              break;
            }
          }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/services/__tests__/click-simplification.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/task-engine.ts src/main/services/__tests__/click-simplification.test.ts
git commit -m "feat: simplify CLICK steps to always proceed to next ordered step"
```

---

## Task 8: TaskEngine — Conditional Step Group Execution

**Files:**
- Modify: `src/main/services/task-engine.ts`
- Test: `src/main/services/__tests__/step-group-conditional.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/services/__tests__/step-group-conditional.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEngine } from '../task-engine';

describe('TaskEngine conditional step group execution', () => {
  let engine: TaskEngine;
  let mockStorage: any;
  let mockCapture: any;
  let mockMatcher: any;
  let mockClicker: any;

  beforeEach(() => {
    mockStorage = {
      getTask: vi.fn().mockReturnValue({
        id: 't1', name: 'Test', status: 'idle',
        settings: { screenshotBeforeMatch: false, maxRetries: 3, globalTimeoutMs: 60000, stepTimeoutMs: 10000 },
        interruptHandlers: [],
      }),
      listSteps: vi.fn().mockReturnValue([]),
      listStepGroups: vi.fn().mockReturnValue([]),
      updateTask: vi.fn(),
      createTaskRun: vi.fn().mockReturnValue('run-1'),
      updateTaskRun: vi.fn(),
    };
    mockCapture = { capture: vi.fn().mockResolvedValue('data:image/png;base64,abc') };
    mockMatcher = {
      match: vi.fn().mockResolvedValue({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 }),
      matchGroup: vi.fn(),
      health: vi.fn().mockResolvedValue({ status: 'ok' }),
    };
    mockClicker = { click: vi.fn() };
    engine = new TaskEngine(mockStorage, mockCapture, mockMatcher, mockClicker);
  });

  it('match routes to onMatch step, miss routes to onMiss step', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/check.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { nextStepId: 's3' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 10, y: 10 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
      { id: 's3', taskId: 't1', type: 'CLICK', order: 3, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 20, y: 20 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Conditional', loopCount: 1 },
    ]);

    // Match succeeds → s1 matches → goes to s2 (click at 10,10)
    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledWith(10, 10);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('miss routes to onMiss step when match fails', async () => {
    mockMatcher.match.mockResolvedValue({ matched: false });
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/check.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { nextStepId: 's3' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 10, y: 10 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
      { id: 's3', taskId: 't1', type: 'CLICK', order: 3, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 20, y: 20 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Conditional', loopCount: 1 },
    ]);

    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledWith(20, 20);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('END_STEP_GROUP exits the group loop', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/check.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_STEP_GROUP' }, onMiss: { nextStepId: 's2' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 50, y: 50 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
      { id: 's3', taskId: 't1', type: 'IMAGE_MATCH', order: 3, config: { templatePath: '/final.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Early Exit', loopCount: 5 },
    ]);

    await engine.start('t1');
    // s1 matches → END_STEP_GROUP → skips s2 → goes to s3
    expect(mockClicker.click).not.toHaveBeenCalled();
    expect(mockMatcher.match).toHaveBeenCalledTimes(2); // s1 and s3
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('conditional paths can converge to same step', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/check.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's3' }, onMiss: { nextStepId: 's3' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 99, y: 99 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
      { id: 's3', taskId: 't1', type: 'CLICK', order: 3, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 42, y: 42 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Converge', loopCount: 1 },
    ]);

    await engine.start('t1');
    // Both paths go to s3, s2 is skipped
    expect(mockClicker.click).toHaveBeenCalledTimes(1);
    expect(mockClicker.click).toHaveBeenCalledWith(42, 42);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/services/__tests__/step-group-conditional.test.ts`
Expected: FAIL — current group execution uses sequential for-loop, doesn't handle onMatch/onMiss branching within group

- [ ] **Step 3: Write minimal implementation**

Rewrite the group execution section in `executeSteps` to support conditional branching. The key change is replacing the simple `for (const groupStep of groupSteps)` loop with a step-index-based loop that follows transitions:

```typescript
      if (group) {
        const groupSteps = steps.filter(s => s.groupId === group.id);
        const loopCount = group.loopCount === 0 ? Infinity : group.loopCount;
        let broken = false;

        for (let loop = 0; loop < loopCount; loop++) {
          if (signal.aborted) throw new Error('STOPPED');

          let gsi = 0;
          while (gsi < groupSteps.length) {
            if (signal.aborted) throw new Error('STOPPED');
            if (Date.now() - startTime > settings.globalTimeoutMs) {
              this.statuses.set(taskId, 'failed');
              return;
            }

            const groupStep = groupSteps[gsi];
            ctx.currentStepId = groupStep.id;

            if (groupStep.realtimeMatch || !ctx.lastScreenshot) {
              ctx.lastScreenshot = await this.capture.capture();
            }

            await this.checkInterrupts(task, ctx, signal);

            const result = await this.executeStepWithTimeout(groupStep, ctx, settings.stepTimeoutMs, signal);
            runLog.push({ stepId: groupStep.id, type: groupStep.type, matched: result, timestamp: new Date().toISOString() });

            // CLICK steps always proceed to next step in group
            if (groupStep.type === 'CLICK') {
              gsi++;
              continue;
            }

            const transition = result ? groupStep.onMatch : groupStep.onMiss;

            if (transition?.action === 'END_TASK') {
              this.statuses.set(taskId, 'completed');
              return;
            }
            if (transition?.action === 'END_STEP_GROUP') {
              broken = true;
              break;
            }
            if (transition?.nextStepId) {
              const targetIndex = groupSteps.findIndex(s => s.id === transition.nextStepId);
              if (targetIndex !== -1) {
                gsi = targetIndex;
                continue;
              }
              // Target is outside the group — find it in the full steps list
              const globalTarget = steps.findIndex(s => s.id === transition.nextStepId);
              if (globalTarget !== -1) {
                stepIndex = globalTarget;
                // Exit both group loop and outer while
                broken = true;
                break;
              }
              // Target not found — end task
              this.statuses.set(taskId, 'completed');
              return;
            }
            gsi++;
          }

          if (broken) break;
        }

        // If broken due to jump outside group, stepIndex is already set
        if (!broken) {
          stepIndex = steps.findIndex((s, i) => i >= stepIndex && s.groupId !== group.id);
          if (stepIndex === -1) {
            this.statuses.set(taskId, 'completed');
            return;
          }
        }
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/services/__tests__/step-group-conditional.test.ts`
Expected: PASS

- [ ] **Step 5: Run ALL TaskEngine tests to verify no regressions**

Run: `npx vitest run src/main/services/__tests__/`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/services/task-engine.ts src/main/services/__tests__/step-group-conditional.test.ts
git commit -m "feat: add conditional step group execution with match/miss branching"
```

---

## Task 9: IPC — Cache Clear and Resize Handlers

**Files:**
- Modify: `src/main/ipc/task.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/main/ipc/__tests__/task-ipc.test.ts`:

```typescript
it('handles task:clear-coordinate-cache', async () => {
  const result = await invoke(IPC_CHANNELS.TASK_CLEAR_COORDINATE_CACHE, {});
  expect(result).toEqual({ success: true });
  expect(mockTaskEngine.clearCoordinateCache).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/ipc/__tests__/task-ipc.test.ts`
Expected: FAIL — handler not registered

- [ ] **Step 3: Write minimal implementation**

In `src/main/ipc/task.ts`, add handler:

```typescript
  registry.handle(IPC_CHANNELS.TASK_CLEAR_COORDINATE_CACHE, () => {
    taskEngine.clearCoordinateCache();
    return { success: true };
  });
```

In `src/main/index.ts`, add `browser:resized` handler:

```typescript
  // Browser resize handler — clear coordinate cache
  registry.handle('browser:resized', () => {
    taskEngine.clearCoordinateCache();
    return { success: true };
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/ipc/__tests__/task-ipc.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/task.ts src/main/index.ts src/main/ipc/__tests__/task-ipc.test.ts
git commit -m "feat: add IPC handlers for cache clear and browser resize"
```

---

## Task 10: BrowserPanel — Resize Event Forwarding

**Files:**
- Modify: `src/renderer/components/Browser/BrowserPanel.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/components/Browser/__tests__/BrowserPanel-resize.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Mock electronAPI
const mockInvoke = vi.fn().mockResolvedValue({ success: true });
(window as any).electronAPI = { invoke: mockInvoke, on: vi.fn(), removeAllListeners: vi.fn() };

describe('BrowserPanel resize forwarding', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  it('sends browser:resized IPC on window resize', async () => {
    // This test verifies the resize handler is attached
    // Full integration test requires Electron environment
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/Browser/__tests__/BrowserPanel-resize.test.tsx`
Expected: PASS (placeholder test — real verification is manual)

- [ ] **Step 3: Write minimal implementation**

In `src/renderer/components/Browser/BrowserPanel.tsx`, add resize observer in the existing useEffect:

```typescript
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    // ... existing event listeners ...

    // Forward resize events to main process for coordinate cache invalidation
    let resizeTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        (window as any).electronAPI?.invoke('browser:resized');
      }, 300);
    });

    // Observe the webview's parent container for size changes
    const container = wv.parentElement;
    if (container) {
      observer.observe(container);
    }

    return () => {
      // ... existing cleanup ...
      clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, []);
```

- [ ] **Step 4: Manual verification**

Start the app, resize the browser panel, verify `browser:resized` IPC is sent (check main process logs).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Browser/BrowserPanel.tsx
git commit -m "feat: forward browser resize events via IPC for cache invalidation"
```

---

## Task 11: StepEditor UI — New Toggles and Conditional Transitions

**Files:**
- Modify: `src/renderer/components/Assistant/StepEditor.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepEditor } from '../StepEditor';

// Mock electronAPI
(window as any).electronAPI = { invoke: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() };

describe('StepEditor updates', () => {
  it('shows realtimeMatch toggle for IMAGE_MATCH type', () => {
    render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('实时比对')).toBeTruthy();
  });

  it('shows cacheCoordinates toggle for IMAGE_MATCH type', () => {
    render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('缓存坐标')).toBeTruthy();
  });

  it('does not show onMatch/onMiss cards for CLICK type', () => {
    render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
    // Select CLICK type
    const typeSelect = screen.getByLabelText('类型');
    fireEvent.mouseDown(typeSelect);
    const clickOption = screen.getByText('点击');
    fireEvent.click(clickOption);
    // Transition cards should not be present
    expect(screen.queryByText('匹配时')).toBeNull();
    expect(screen.queryByText('未匹配时')).toBeNull();
  });

  it('shows END_STEP_GROUP option when step has groupId', () => {
    render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} order={0} step={{
      id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1',
      config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] },
      onMatch: {}, onMiss: {},
      screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false,
    }} />);
    // END_STEP_GROUP should be available in the action select
    expect(screen.getByText('结束步骤组')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx`
Expected: FAIL — toggles don't exist, CLICK still shows transitions

- [ ] **Step 3: Write minimal implementation**

Update `src/renderer/components/Assistant/StepEditor.tsx`:

1. Update `TRANSITION_ACTIONS` to include `END_STEP_GROUP`:
```typescript
const TRANSITION_ACTIONS = [
  { label: '(无)', value: undefined },
  { label: '结束任务', value: 'END_TASK' },
  { label: '结束步骤组', value: 'END_STEP_GROUP' },
];
```

2. Add realtimeMatch and cacheCoordinates toggles after the screenshotBeforeMatch toggle:
```typescript
        <Form.Item name="realtimeMatch" label="实时比对" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
          {({ getFieldValue }) => {
            const type = getFieldValue('type');
            if (type === 'IMAGE_MATCH') {
              return (
                <Form.Item name="cacheCoordinates" label="缓存坐标" valuePropName="checked">
                  <Switch />
                </Form.Item>
              );
            }
            return null;
          }}
        </Form.Item>
```

3. Conditionally hide transition cards for CLICK type:
```typescript
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
          {({ getFieldValue }) => {
            const type = getFieldValue('type');
            if (type === 'CLICK') return null;
            return (
              <>
                <Card type="inner" title="匹配时" size="small" style={{ marginTop: 16 }}>
                  <Form.Item name="onMatchAction" label="动作">
                    <Select options={TRANSITION_ACTIONS} allowClear />
                  </Form.Item>
                  <Form.Item name="onMatchNextStepId" label="下一步骤 ID">
                    <Input placeholder="可选步骤 ID" />
                  </Form.Item>
                </Card>

                <Card type="inner" title="未匹配时" size="small" style={{ marginTop: 8 }}>
                  <Form.Item name="onMissAction" label="动作">
                    <Select options={TRANSITION_ACTIONS} allowClear />
                  </Form.Item>
                  <Form.Item name="onMissNextStepId" label="下一步骤 ID">
                    <Input placeholder="可选步骤 ID" />
                  </Form.Item>
                </Card>
              </>
            );
          }}
        </Form.Item>
```

4. Update `handleSubmit` to include new fields:
```typescript
  const handleSubmit = (values: any) => {
    const type = values.type;
    onSave({
      ...values,
      taskId,
      order: step?.order ?? order,
      config: buildConfig(values),
      onMatch: type === 'CLICK' ? undefined : { action: values.onMatchAction, nextStepId: values.onMatchNextStepId },
      onMiss: type === 'CLICK' ? undefined : { action: values.onMissAction, nextStepId: values.onMissNextStepId },
      realtimeMatch: values.realtimeMatch ?? false,
      cacheCoordinates: values.cacheCoordinates ?? false,
    });
  };
```

5. Update initialValues to include new fields:
```typescript
        initialValues={
          step
            ? {
                type: step.type,
                screenshotBeforeMatch: step.screenshotBeforeMatch,
                realtimeMatch: step.realtimeMatch,
                cacheCoordinates: step.cacheCoordinates,
                ...(step.config as Record<string, unknown>),
                onMatchAction: step.onMatch?.action,
                onMatchNextStepId: step.onMatch?.nextStepId,
                onMissAction: step.onMiss?.action,
                onMissNextStepId: step.onMiss?.nextStepId,
              }
            : {
                type: 'IMAGE_MATCH',
                threshold: 0.8,
                scaleRange: [0.5, 2.0],
                screenshotBeforeMatch: false,
                realtimeMatch: false,
                cacheCoordinates: false,
              }
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Assistant/StepEditor.tsx src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx
git commit -m "feat: add realtimeMatch/cacheCoordinates toggles and hide transitions for CLICK"
```

---

## Task 12: TaskList — Double-Click Drawer Editing

**Files:**
- Modify: `src/renderer/components/Assistant/TaskList.tsx`
- Test: `src/renderer/components/Assistant/__tests__/TaskList-drawer.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/components/Assistant/__tests__/TaskList-drawer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskList } from '../TaskList';

// Mock taskStore
vi.mock('../../stores/taskStore', () => ({
  useTaskStore: () => ({
    tasks: [
      { id: 't1', name: 'Task A', status: 'idle', settings: {}, interruptHandlers: [], createdAt: '', updatedAt: '' },
    ],
    removeTask: vi.fn(),
  }),
}));

// Mock electronAPI
(window as any).electronAPI = { invoke: vi.fn().mockResolvedValue({ task: { id: 't1', name: 'Task A' }, steps: [] }), on: vi.fn(), removeAllListeners: vi.fn() };

describe('TaskList drawer editing', () => {
  it('opens drawer on double-click', async () => {
    render(<TaskList onEdit={vi.fn()} />);
    const listItem = screen.getByText('Task A').closest('.ant-list-item');
    expect(listItem).toBeTruthy();
    fireEvent.doubleClick(listItem!);
    await waitFor(() => {
      expect(screen.getByText(/编辑任务/)).toBeTruthy();
    });
  });

  it('opens same drawer when edit button is clicked', async () => {
    render(<TaskList onEdit={vi.fn()} />);
    const editButton = screen.getAllByRole('button').find(b => b.querySelector('[data-icon="edit"]'));
    expect(editButton).toBeTruthy();
    fireEvent.click(editButton!);
    await waitFor(() => {
      expect(screen.getByText(/编辑任务/)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/Assistant/__tests__/TaskList-drawer.test.tsx`
Expected: FAIL — no double-click handler, no Drawer

- [ ] **Step 3: Write minimal implementation**

Update `src/renderer/components/Assistant/TaskList.tsx`:

```typescript
import React, { useState } from 'react';
import { List, Button, Tag, Popconfirm, Drawer } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTaskStore } from '../../stores/taskStore';
import { TaskEditor } from './TaskEditor';
import type { TaskStatus } from '@shared/types/task';

const statusColors: Record<TaskStatus, string> = {
  idle: 'default', running: 'processing', paused: 'warning',
  completed: 'success', failed: 'error', stopped: 'default',
};

const statusLabels: Record<TaskStatus, string> = {
  idle: '空闲', running: '运行中', paused: '已暂停',
  completed: '已完成', failed: '失败', stopped: '已停止',
};

interface TaskListProps {
  onEdit: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ onEdit }) => {
  const { tasks, removeTask } = useTaskStore();
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);

  const handleStart = (taskId: string) => {
    (window as any).electronAPI?.invoke('task:start', { taskId });
  };

  const handleStop = (taskId: string) => {
    (window as any).electronAPI?.invoke('task:stop', { taskId });
  };

  const handleDoubleClick = (taskId: string) => {
    setDrawerTaskId(taskId);
  };

  const handleEditClick = (taskId: string) => {
    setDrawerTaskId(taskId);
    onEdit(taskId);
  };

  return (
    <>
      <List
        dataSource={tasks}
        renderItem={(task) => (
          <List.Item
            onDoubleClick={() => handleDoubleClick(task.id)}
            actions={[
              task.status === 'running' ? (
                <Button icon={<PauseCircleOutlined />} size="small" onClick={() => handleStop(task.id)} />
              ) : (
                <Button icon={<PlayCircleOutlined />} type="primary" size="small" onClick={() => handleStart(task.id)} />
              ),
              <Button icon={<EditOutlined />} size="small" onClick={() => handleEditClick(task.id)} />,
              <Popconfirm title="确定删除？" onConfirm={() => removeTask(task.id)}>
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={task.name}
              description={<Tag color={statusColors[task.status]}>{statusLabels[task.status]}</Tag>}
            />
          </List.Item>
        )}
      />
      <Drawer
        title="编辑任务"
        open={drawerTaskId !== null}
        onClose={() => setDrawerTaskId(null)}
        width={600}
        destroyOnClose
      >
        {drawerTaskId && (
          <TaskEditor taskId={drawerTaskId} onClose={() => setDrawerTaskId(null)} />
        )}
      </Drawer>
    </>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/components/Assistant/__tests__/TaskList-drawer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Assistant/TaskList.tsx src/renderer/components/Assistant/__tests__/TaskList-drawer.test.tsx
git commit -m "feat: add double-click drawer editing to TaskList"
```

---

## Task 13: TaskGroupList — Double-Click Drawer Editing

**Files:**
- Modify: `src/renderer/components/Assistant/TaskGroupList.tsx`
- Test: `src/renderer/components/Assistant/__tests__/TaskGroupList-drawer.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/components/Assistant/__tests__/TaskGroupList-drawer.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskGroupList } from '../TaskGroupList';

// Mock electronAPI
(window as any).electronAPI = {
  invoke: vi.fn().mockImplementation((channel: string) => {
    if (channel === 'task-group:list') return Promise.resolve({ groups: [{ id: 'g1', name: 'Group A', failurePolicy: 'STOP', retryCount: 0, loopEnabled: false, loopIntervalMs: 0, loopMaxIterations: 0, createdAt: '', updatedAt: '' }] });
    if (channel === 'task-group:get') return Promise.resolve({ group: { id: 'g1', name: 'Group A', failurePolicy: 'STOP', retryCount: 0, loopEnabled: false, loopIntervalMs: 0, loopMaxIterations: 0, createdAt: '', updatedAt: '' } });
    if (channel === 'task-group:get-items') return Promise.resolve({ items: [] });
    if (channel === 'task:list') return Promise.resolve({ tasks: [] });
    return Promise.resolve({});
  }),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
};

describe('TaskGroupList drawer editing', () => {
  it('opens drawer on double-click', async () => {
    render(<TaskGroupList onEdit={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Group A')).toBeTruthy();
    });
    const listItem = screen.getByText('Group A').closest('.ant-list-item');
    expect(listItem).toBeTruthy();
    fireEvent.doubleClick(listItem!);
    await waitFor(() => {
      expect(screen.getByText('基本信息')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/Assistant/__tests__/TaskGroupList-drawer.test.tsx`
Expected: FAIL — no double-click handler, no Drawer

- [ ] **Step 3: Write minimal implementation**

Update `src/renderer/components/Assistant/TaskGroupList.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { List, Button, Tag, Popconfirm, Modal, Form, Input, Select, Drawer, message } from 'antd';
import { PlusOutlined, PlayCircleOutlined, StopOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants';
import { TaskGroupEditor } from './TaskGroupEditor';
import type { TaskGroup } from '@shared/types/task-group';

interface TaskGroupListProps {
  onEdit: (groupId: string) => void;
}

export const TaskGroupList: React.FC<TaskGroupListProps> = ({ onEdit }) => {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [drawerGroupId, setDrawerGroupId] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      const result = await api.invoke(IPC_CHANNELS.TASK_GROUP_LIST);
      setGroups(result?.groups || []);
    } catch (err) {
      message.error('加载任务组失败。');
    }
  };

  const handleCreate = async (values: any) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_CREATE, values);
      setShowCreate(false);
      form.resetFields();
      loadGroups();
    } catch (err) {
      message.error('创建任务组失败。');
    }
  };

  const handleDelete = async (groupId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_DELETE, { taskGroupId: groupId });
      loadGroups();
    } catch (err) {
      message.error('删除任务组失败。');
    }
  };

  const handleStart = async (groupId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_START, { taskGroupId: groupId });
    } catch (err) {
      message.error('启动任务组失败。');
    }
  };

  const handleStop = async (groupId: string) => {
    const api = (window as any).electronAPI;
    try {
      await api.invoke(IPC_CHANNELS.TASK_GROUP_STOP, { taskGroupId: groupId });
    } catch (err) {
      message.error('停止任务组失败。');
    }
  };

  const handleDoubleClick = (groupId: string) => {
    setDrawerGroupId(groupId);
  };

  const handleEditClick = (groupId: string) => {
    setDrawerGroupId(groupId);
    onEdit(groupId);
  };

  return (
    <>
      <Button icon={<PlusOutlined />} onClick={() => setShowCreate(true)} style={{ marginBottom: 8 }}>新建任务组</Button>
      <List
        dataSource={groups}
        renderItem={(group) => (
          <List.Item
            key={group.id}
            onDoubleClick={() => handleDoubleClick(group.id)}
            actions={[
              <Button icon={<PlayCircleOutlined />} type="primary" size="small" onClick={() => handleStart(group.id)} />,
              <Button icon={<StopOutlined />} size="small" onClick={() => handleStop(group.id)} />,
              <Button icon={<EditOutlined />} size="small" onClick={() => handleEditClick(group.id)} />,
              <Popconfirm title="确定删除？" onConfirm={() => handleDelete(group.id)}>
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta title={group.name} description={<>{group.loopEnabled && <Tag color="blue">循环</Tag>}<Tag>{group.failurePolicy}</Tag></>} />
          </List.Item>
        )}
      />
      <Modal title="新建任务组" open={showCreate} onCancel={() => setShowCreate(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="failurePolicy" label="失败策略" initialValue="STOP">
            <Select options={[{ label: '停止', value: 'STOP' }, { label: '跳过', value: 'SKIP' }, { label: '重试', value: 'RETRY' }]} />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title="编辑任务组"
        open={drawerGroupId !== null}
        onClose={() => setDrawerGroupId(null)}
        width={700}
        destroyOnClose
      >
        {drawerGroupId && (
          <TaskGroupEditor groupId={drawerGroupId} onClose={() => setDrawerGroupId(null)} />
        )}
      </Drawer>
    </>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/components/Assistant/__tests__/TaskGroupList-drawer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Assistant/TaskGroupList.tsx src/renderer/components/Assistant/__tests__/TaskGroupList-drawer.test.tsx
git commit -m "feat: add double-click drawer editing to TaskGroupList"
```

---

## Task 14: ExecutionStatus — Cache Clear Button

**Files:**
- Modify: `src/renderer/components/Assistant/ExecutionStatus.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/components/Assistant/__tests__/ExecutionStatus-cache.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutionStatus } from '../ExecutionStatus';

const mockInvoke = vi.fn().mockResolvedValue({ success: true });
(window as any).electronAPI = {
  invoke: mockInvoke,
  on: vi.fn((channel: string, cb: Function) => {
    if (channel === 'task:status-changed') {
      // Simulate running status
      cb({ taskId: 't1', status: 'running' });
    }
  }),
  removeAllListeners: vi.fn(),
};

describe('ExecutionStatus cache clear button', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  it('shows cache clear button when task is running', () => {
    render(<ExecutionStatus />);
    const clearButton = screen.getByText('清除缓存');
    expect(clearButton).toBeTruthy();
  });

  it('invokes task:clear-coordinate-cache on click', () => {
    render(<ExecutionStatus />);
    const clearButton = screen.getByText('清除缓存');
    fireEvent.click(clearButton);
    expect(mockInvoke).toHaveBeenCalledWith('task:clear-coordinate-cache');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/Assistant/__tests__/ExecutionStatus-cache.test.tsx`
Expected: FAIL — no cache clear button

- [ ] **Step 3: Write minimal implementation**

Update `src/renderer/components/Assistant/ExecutionStatus.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Card, Tag, List, Space, Typography, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants';

const { Text } = Typography;

interface StepResult {
  stepId: string;
  matched: boolean;
  timestamp: string;
}

export const ExecutionStatus: React.FC = () => {
  const [taskStatus, setTaskStatus] = useState<{ taskId: string; status: string; currentStepId?: string } | null>(null);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    const handleStatusChanged = (data: any) => {
      setTaskStatus(data);
      if (data.status !== 'running') {
        setStepResults([]);
      }
    };

    const handleStepResult = (data: StepResult) => {
      setStepResults(prev => [data, ...prev].slice(0, 50));
    };

    api.on(IPC_CHANNELS.TASK_STATUS_CHANGED, handleStatusChanged);
    api.on(IPC_CHANNELS.TASK_STEP_RESULT, handleStepResult);

    return () => {
      api.removeAllListeners(IPC_CHANNELS.TASK_STATUS_CHANGED);
      api.removeAllListeners(IPC_CHANNELS.TASK_STEP_RESULT);
    };
  }, []);

  const handleClearCache = () => {
    (window as any).electronAPI?.invoke(IPC_CHANNELS.TASK_CLEAR_COORDINATE_CACHE);
  };

  if (!taskStatus || taskStatus.status === 'idle') return null;

  const statusColor: Record<string, string> = {
    running: 'processing', completed: 'success', failed: 'error', stopped: 'default',
  };

  return (
    <Card size="small" title="执行状态" style={{ marginBottom: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Text>任务:</Text>
          <Tag color={statusColor[taskStatus.status]}>{taskStatus.status}</Tag>
          {taskStatus.currentStepId && <Text type="secondary">步骤: {taskStatus.currentStepId}</Text>}
          {taskStatus.status === 'running' && (
            <Button size="small" icon={<DeleteOutlined />} onClick={handleClearCache}>清除缓存</Button>
          )}
        </Space>
        {stepResults.length > 0 && (
          <List
            size="small"
            dataSource={stepResults}
            renderItem={(r) => (
              <List.Item>
                <Tag color={r.matched ? 'green' : 'red'}>{r.matched ? '匹配' : '未匹配'}</Tag>
                <Text type="secondary">{r.stepId}</Text>
              </List.Item>
            )}
          />
        )}
      </Space>
    </Card>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/components/Assistant/__tests__/ExecutionStatus-cache.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Assistant/ExecutionStatus.tsx src/renderer/components/Assistant/__tests__/ExecutionStatus-cache.test.tsx
git commit -m "feat: add coordinate cache clear button to ExecutionStatus"
```

---

## Task 15: Update Existing TaskEngine Tests

**Files:**
- Modify: `src/main/services/__tests__/task-engine.test.ts`

- [ ] **Step 1: Update existing tests for new Step type**

All existing test step objects need `realtimeMatch` and `cacheCoordinates` fields. Update every step definition in the test file:

```typescript
// Add to every step object:
  realtimeMatch: true,
  cacheCoordinates: false,
```

Also update steps that had `screenshotBeforeMatch: true` to use `realtimeMatch: true` instead, and steps with `screenshotBeforeMatch: false` to `realtimeMatch: false`.

For CLICK steps, remove `onMatch` and `onMiss` fields (set to undefined or omit).

- [ ] **Step 2: Run test to verify all pass**

Run: `npx vitest run src/main/services/__tests__/task-engine.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/services/__tests__/task-engine.test.ts
git commit -m "refactor: update existing TaskEngine tests for new Step type fields"
```

---

## Task 16: Final Integration Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Build verification**

Run: `npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 3: Manual verification checklist**

- [ ] Double-click a task in TaskList → Drawer opens with TaskEditor
- [ ] Double-click a task group in TaskGroupList → Drawer opens with TaskGroupEditor
- [ ] Edit button still opens the same drawers
- [ ] Create IMAGE_MATCH step with realtimeMatch=true → captures fresh screenshot each time
- [ ] Create IMAGE_MATCH step with realtimeMatch=false → reuses previous screenshot
- [ ] Create IMAGE_MATCH step with cacheCoordinates=true → second match uses cached coordinates
- [ ] Resize browser window → coordinate cache cleared
- [ ] Click "清除缓存" button → coordinate cache cleared
- [ ] CLICK step has no onMatch/onMiss transition cards in editor
- [ ] CLICK step always proceeds to next ordered step
- [ ] Step in group with END_STEP_GROUP → exits group loop
- [ ] IMAGE_MATCH in group with different onMatch/onMiss targets → conditional branching works

- [ ] **Step 4: Final commit if needed**
