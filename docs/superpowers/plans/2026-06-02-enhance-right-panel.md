# Enhance Right Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Chinese UI localization and task group orchestration (conditional branching, looping, drag-and-drop ordering) to the right panel.

**Architecture:** Extend the SQLite schema with loop and jump-target fields, rewrite TaskGroupEngine to follow conditional branches and loop, redesign TaskGroupEditor with @dnd-kit drag-and-drop, and replace all English strings with Chinese in right-panel components.

**Tech Stack:** TypeScript, Vitest, better-sqlite3, React, Ant Design 6, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities

---

## File Structure

```
Files to modify:
  src/shared/types/task-group.ts          -- Add loop + jump target types
  src/shared/constants.ts                 -- Add 3 new IPC channels
  src/main/db/schema.ts                   -- Add migration for new columns
  src/main/services/storage.ts            -- Add 3 new methods
  src/main/services/task-group-engine.ts  -- Rewrite with branching + looping
  src/main/ipc/task-group.ts              -- Add 3 new IPC handlers
  src/renderer/App.tsx                    -- Chinese tab/button labels
  src/renderer/components/Assistant/TaskList.tsx           -- Chinese strings
  src/renderer/components/Assistant/TaskGroupList.tsx      -- Chinese strings + loop indicator
  src/renderer/components/Assistant/TaskGroupEditor.tsx    -- Major rewrite: DnD + conditions + loop
  src/renderer/components/Assistant/TaskEditor.tsx         -- Chinese strings
  src/renderer/components/Assistant/StepEditor.tsx         -- Chinese strings
  src/renderer/components/Assistant/ExecutionStatus.tsx    -- Chinese strings
  src/renderer/components/Tools/LogViewer.tsx              -- Chinese strings
  src/renderer/components/Tools/ImageCompare.tsx           -- Chinese strings
  src/renderer/components/Tools/ClickTest.tsx              -- Chinese strings
  src/renderer/components/Network/NetworkLog.tsx           -- Chinese strings

Files to create:
  src/main/db/__tests__/migration-v2.test.ts               -- Migration test
  src/main/services/__tests__/task-group-engine-branching.test.ts  -- Branching/loop tests

Dependencies to install:
  @dnd-kit/core
  @dnd-kit/sortable
  @dnd-kit/utilities
```

---

## Task 1: Type Definitions & IPC Constants

**Files:**
- Modify: `src/shared/types/task-group.ts`
- Modify: `src/shared/constants.ts`
- Test: `src/shared/__tests__/types.test.ts` (existing)

- [ ] **Step 1: Write the failing test**

Add to `src/shared/__tests__/types.test.ts`:

```typescript
it('TaskGroup has loop fields', () => {
  const group: import('@shared/types/task-group').TaskGroup = {
    id: '1', name: 'G', failurePolicy: 'STOP', retryCount: 0,
    loopEnabled: true, loopIntervalMs: 60000, loopMaxIterations: 5,
    createdAt: '', updatedAt: '',
  };
  expect(group.loopEnabled).toBe(true);
  expect(group.loopIntervalMs).toBe(60000);
  expect(group.loopMaxIterations).toBe(5);
});

it('TaskGroupItem has jump target fields', () => {
  const item: import('@shared/types/task-group').TaskGroupItem = {
    id: '1', taskGroupId: 'g', taskId: 't', order: 0,
    onSuccess: 'item-2', onFailure: 'END',
  };
  expect(item.onSuccess).toBe('item-2');
  expect(item.onFailure).toBe('END');
});

it('has new IPC channels', () => {
  const { IPC_CHANNELS } = await import('@shared/constants');
  expect(IPC_CHANNELS.TASK_GROUP_UPDATE_LOOP).toBe('task-group:update-loop');
  expect(IPC_CHANNELS.TASK_GROUP_UPDATE_ITEM_TARGET).toBe('task-group:update-item-target');
  expect(IPC_CHANNELS.TASK_GROUP_REORDER_ITEMS).toBe('task-group:reorder-items');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/__tests__/types.test.ts --reporter=verbose`
Expected: FAIL — `loopEnabled` not in type, new IPC channels missing.

- [ ] **Step 3: Implement type changes**

In `src/shared/types/task-group.ts`, add fields to `TaskGroup`:

```typescript
export interface TaskGroup {
  id: string;
  name: string;
  failurePolicy: FailurePolicy;
  retryCount: number;
  loopEnabled: boolean;
  loopIntervalMs: number;
  loopMaxIterations: number;
  createdAt: string;
  updatedAt: string;
}
```

Add fields to `TaskGroupItem`:

```typescript
export interface TaskGroupItem {
  id: string;
  taskGroupId: string;
  taskId: string;
  order: number;
  onSuccess: string | null;
  onFailure: string | null;
}
```

In `src/shared/constants.ts`, add inside `IPC_CHANNELS`:

```typescript
TASK_GROUP_UPDATE_LOOP: 'task-group:update-loop',
TASK_GROUP_UPDATE_ITEM_TARGET: 'task-group:update-item-target',
TASK_GROUP_REORDER_ITEMS: 'task-group:reorder-items',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/__tests__/types.test.ts --reporter=verbose`
Expected: PASS.

- [ ] **Step 5: Refactor**

Verify no other files break from the type changes. Run full test suite:

Run: `npx vitest run --reporter=verbose`
Expected: Some tests may fail because `StorageService.getTaskGroup` and `createTaskGroup` don't return the new fields yet. That's expected — fixed in Task 2.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types/task-group.ts src/shared/constants.ts src/shared/__tests__/types.test.ts
git commit -m "feat: add loop and jump-target types, new IPC channels"
```

---

## Task 2: Database Migration & Storage Service

**Files:**
- Modify: `src/main/db/schema.ts`
- Modify: `src/main/services/storage.ts`
- Create: `src/main/db/__tests__/migration-v2.test.ts`
- Modify: `src/main/services/__tests__/storage.test.ts`

- [ ] **Step 1: Write the failing test for migration**

Create `src/main/db/__tests__/migration-v2.test.ts`:

```typescript
import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { createSchema } from '../schema';
import { runMigrations, getCurrentVersion } from '../migrations';

describe('migration v2: loop and jump target fields', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  it('adds loop columns to task_groups', () => {
    runMigrations(db);
    const columns = db.prepare("PRAGMA table_info(task_groups)").all() as any[];
    const names = columns.map((c: any) => c.name);
    expect(names).toContain('loop_enabled');
    expect(names).toContain('loop_interval_ms');
    expect(names).toContain('loop_max_iterations');
  });

  it('adds jump target columns to task_group_items', () => {
    runMigrations(db);
    const columns = db.prepare("PRAGMA table_info(task_group_items)").all() as any[];
    const names = columns.map((c: any) => c.name);
    expect(names).toContain('on_success');
    expect(names).toContain('on_failure');
  });

  it('sets default values for loop fields', () => {
    runMigrations(db);
    const row = db.prepare("SELECT loop_enabled, loop_interval_ms, loop_max_iterations FROM task_groups LIMIT 0");
    // Verify defaults by inserting a row
    db.prepare("INSERT INTO task_groups (id, name) VALUES ('test', 'Test')").run();
    const group = db.prepare("SELECT * FROM task_groups WHERE id = 'test'").get() as any;
    expect(group.loop_enabled).toBe(0);
    expect(group.loop_interval_ms).toBe(0);
    expect(group.loop_max_iterations).toBe(0);
  });

  it('sets default NULL for jump targets', () => {
    runMigrations(db);
    db.prepare("INSERT INTO task_groups (id, name) VALUES ('g1', 'G')").run();
    db.prepare("INSERT INTO tasks (id, name) VALUES ('t1', 'T')").run();
    db.prepare('INSERT INTO task_group_items (id, task_group_id, task_id, "order") VALUES (\'i1\', \'g1\', \'t1\', 0)').run();
    const item = db.prepare("SELECT * FROM task_group_items WHERE id = 'i1'").get() as any;
    expect(item.on_success).toBeNull();
    expect(item.on_failure).toBeNull();
  });

  it('updates schema version to 2', () => {
    runMigrations(db);
    expect(getCurrentVersion(db)).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/db/__tests__/migration-v2.test.ts --reporter=verbose`
Expected: FAIL — migration v2 doesn't exist yet.

- [ ] **Step 3: Implement migration**

In `src/main/db/schema.ts`, add the new columns to the `CREATE TABLE` statements:

In `task_groups` table, add after `retry_count`:
```sql
loop_enabled INTEGER DEFAULT 0,
loop_interval_ms INTEGER DEFAULT 0,
loop_max_iterations INTEGER DEFAULT 0,
```

In `task_group_items` table, add after `"order"`:
```sql
on_success TEXT DEFAULT NULL,
on_failure TEXT DEFAULT NULL,
```

In `src/main/db/migrations.ts`, add migration v2:

```typescript
import type Database from 'better-sqlite3';

const migrations: Array<{ version: number; up: (db: Database.Database) => void }> = [
  {
    version: 2,
    up: (db: Database.Database) => {
      db.exec(`
        ALTER TABLE task_groups ADD COLUMN loop_enabled INTEGER DEFAULT 0;
        ALTER TABLE task_groups ADD COLUMN loop_interval_ms INTEGER DEFAULT 0;
        ALTER TABLE task_groups ADD COLUMN loop_max_iterations INTEGER DEFAULT 0;
        ALTER TABLE task_group_items ADD COLUMN on_success TEXT DEFAULT NULL;
        ALTER TABLE task_group_items ADD COLUMN on_failure TEXT DEFAULT NULL;
      `);
    },
  },
];

export function getCurrentVersion(db: Database.Database): number {
  const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number } | undefined;
  return row?.version ?? 0;
}

export function runMigrations(db: Database.Database): void {
  const currentVersion = getCurrentVersion(db);
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      migration.up(db);
      db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(migration.version);
    }
  }
}
```

- [ ] **Step 4: Run migration test to verify it passes**

Run: `npx vitest run src/main/db/__tests__/migration-v2.test.ts --reporter=verbose`
Expected: PASS.

- [ ] **Step 5: Write failing test for storage methods**

Add to `src/main/services/__tests__/storage.test.ts`:

```typescript
describe('loop and jump target operations', () => {
  it('updateTaskGroupLoop updates loop fields', () => {
    const group = storage.createTaskGroup({ name: 'G', failurePolicy: 'STOP' });
    storage.updateTaskGroupLoop(group.id, { loopEnabled: true, loopIntervalMs: 30000, loopMaxIterations: 5 });
    const updated = storage.getTaskGroup(group.id);
    expect(updated?.loopEnabled).toBe(true);
    expect(updated?.loopIntervalMs).toBe(30000);
    expect(updated?.loopMaxIterations).toBe(5);
  });

  it('updateTaskGroupItemTarget updates jump targets', () => {
    const task = storage.createTask({ name: 'T' });
    const group = storage.createTaskGroup({ name: 'G', failurePolicy: 'STOP' });
    const item = storage.addTaskGroupItem(group.id, task.id, 0);
    storage.updateTaskGroupItemTarget(item.id, 'other-item-id', 'END');
    const items = storage.listTaskGroupItems(group.id);
    expect(items[0].onSuccess).toBe('other-item-id');
    expect(items[0].onFailure).toBe('END');
  });

  it('reorderTaskGroupItems updates order', () => {
    const t1 = storage.createTask({ name: 'T1' });
    const t2 = storage.createTask({ name: 'T2' });
    const group = storage.createTaskGroup({ name: 'G', failurePolicy: 'STOP' });
    const i1 = storage.addTaskGroupItem(group.id, t1.id, 0);
    const i2 = storage.addTaskGroupItem(group.id, t2.id, 1);
    storage.reorderTaskGroupItems(group.id, [i2.id, i1.id]);
    const items = storage.listTaskGroupItems(group.id);
    expect(items[0].id).toBe(i2.id);
    expect(items[1].id).toBe(i1.id);
  });
});
```

- [ ] **Step 6: Run storage test to verify it fails**

Run: `npx vitest run src/main/services/__tests__/storage.test.ts --reporter=verbose`
Expected: FAIL — new methods don't exist.

- [ ] **Step 7: Implement storage methods**

In `src/main/services/storage.ts`, update `getTaskGroup` to return new fields:

```typescript
getTaskGroup(id: string): TaskGroup | undefined {
  const row = this.db.prepare('SELECT * FROM task_groups WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    failurePolicy: row.failure_policy,
    retryCount: row.retry_count,
    loopEnabled: row.loop_enabled === 1,
    loopIntervalMs: row.loop_interval_ms,
    loopMaxIterations: row.loop_max_iterations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

Update `listTaskGroups` similarly. Update `createTaskGroup` to return new fields (defaulting to false/0/0). Update `addTaskGroupItem` to return `onSuccess: null, onFailure: null`. Update `listTaskGroupItems` to map new fields.

Add three new methods:

```typescript
updateTaskGroupLoop(id: string, data: { loopEnabled: boolean; loopIntervalMs: number; loopMaxIterations: number }): void {
  const now = new Date().toISOString();
  this.db.prepare(
    'UPDATE task_groups SET loop_enabled = ?, loop_interval_ms = ?, loop_max_iterations = ?, updated_at = ? WHERE id = ?'
  ).run(data.loopEnabled ? 1 : 0, data.loopIntervalMs, data.loopMaxIterations, now, id);
}

updateTaskGroupItemTarget(itemId: string, onSuccess: string | null, onFailure: string | null): void {
  this.db.prepare(
    'UPDATE task_group_items SET on_success = ?, on_failure = ? WHERE id = ?'
  ).run(onSuccess, onFailure, itemId);
}

reorderTaskGroupItems(taskGroupId: string, itemIds: string[]): void {
  const runAll = this.db.transaction(() => {
    for (let i = 0; i < itemIds.length; i++) {
      this.db.prepare('UPDATE task_group_items SET "order" = ? WHERE id = ? AND task_group_id = ?').run(i, itemIds[i], taskGroupId);
    }
  });
  runAll();
}
```

- [ ] **Step 8: Run all tests to verify**

Run: `npx vitest run --reporter=verbose`
Expected: All PASS. Existing tests that mock `getTaskGroup` will still pass because they use mocks. The real `getTaskGroup` now returns new fields.

- [ ] **Step 9: Commit**

```bash
git add src/main/db/ src/main/services/storage.ts src/main/services/__tests__/storage.test.ts src/main/db/__tests__/migration-v2.test.ts
git commit -m "feat: DB migration v2 with loop/jump-target fields, storage methods"
```

---

## Task 3: IPC Handlers for New Operations

**Files:**
- Modify: `src/main/ipc/task-group.ts`
- Modify: `src/main/ipc/__tests__/task-group-ipc.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/main/ipc/__tests__/task-group-ipc.test.ts`:

```typescript
it('registers task-group:update-loop handler', () => {
  const handler = mockRegistry.getHandler('task-group:update-loop');
  expect(handler).toBeDefined();
});

it('registers task-group:update-item-target handler', () => {
  const handler = mockRegistry.getHandler('task-group:update-item-target');
  expect(handler).toBeDefined();
});

it('registers task-group:reorder-items handler', () => {
  const handler = mockRegistry.getHandler('task-group:reorder-items');
  expect(handler).toBeDefined();
});

it('update-loop handler calls storage.updateTaskGroupLoop', () => {
  const handler = mockRegistry.getHandler('task-group:update-loop');
  handler({}, { taskGroupId: 'g1', loopEnabled: true, loopIntervalMs: 30000, loopMaxIterations: 5 });
  expect(mockStorage.updateTaskGroupLoop).toHaveBeenCalledWith('g1', {
    loopEnabled: true, loopIntervalMs: 30000, loopMaxIterations: 5,
  });
});

it('update-item-target handler calls storage.updateTaskGroupItemTarget', () => {
  const handler = mockRegistry.getHandler('task-group:update-item-target');
  handler({}, { itemId: 'i1', onSuccess: 'i2', onFailure: 'END' });
  expect(mockStorage.updateTaskGroupItemTarget).toHaveBeenCalledWith('i1', 'i2', 'END');
});

it('reorder-items handler calls storage.reorderTaskGroupItems', () => {
  const handler = mockRegistry.getHandler('task-group:reorder-items');
  handler({}, { taskGroupId: 'g1', itemIds: ['i2', 'i1'] });
  expect(mockStorage.reorderTaskGroupItems).toHaveBeenCalledWith('g1', ['i2', 'i1']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/ipc/__tests__/task-group-ipc.test.ts --reporter=verbose`
Expected: FAIL — handlers not registered.

- [ ] **Step 3: Implement IPC handlers**

In `src/main/ipc/task-group.ts`, add before the closing `}`:

```typescript
registry.handle(IPC_CHANNELS.TASK_GROUP_UPDATE_LOOP, (_event: any, data: { taskGroupId: string; loopEnabled: boolean; loopIntervalMs: number; loopMaxIterations: number }) => {
  storage.updateTaskGroupLoop(data.taskGroupId, {
    loopEnabled: data.loopEnabled,
    loopIntervalMs: data.loopIntervalMs,
    loopMaxIterations: data.loopMaxIterations,
  });
  return { success: true };
});

registry.handle(IPC_CHANNELS.TASK_GROUP_UPDATE_ITEM_TARGET, (_event: any, data: { itemId: string; onSuccess: string | null; onFailure: string | null }) => {
  storage.updateTaskGroupItemTarget(data.itemId, data.onSuccess, data.onFailure);
  return { success: true };
});

registry.handle(IPC_CHANNELS.TASK_GROUP_REORDER_ITEMS, (_event: any, data: { taskGroupId: string; itemIds: string[] }) => {
  storage.reorderTaskGroupItems(data.taskGroupId, data.itemIds);
  return { success: true };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/ipc/__tests__/task-group-ipc.test.ts --reporter=verbose`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/task-group.ts src/main/ipc/__tests__/task-group-ipc.test.ts
git commit -m "feat: IPC handlers for loop config, jump targets, reordering"
```

---

## Task 4: TaskGroupEngine Rewrite with Branching & Looping

**Files:**
- Modify: `src/main/services/task-group-engine.ts`
- Create: `src/main/services/__tests__/task-group-engine-branching.test.ts`

- [ ] **Step 1: Write the failing tests for branching**

Create `src/main/services/__tests__/task-group-engine-branching.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskGroupEngine } from '../task-group-engine';

describe('TaskGroupEngine branching and looping', () => {
  let engine: TaskGroupEngine;
  let mockStorage: any;
  let mockTaskEngine: any;

  beforeEach(() => {
    mockStorage = {
      getTaskGroup: vi.fn().mockReturnValue({
        id: 'g1', name: 'Group', failurePolicy: 'STOP', retryCount: 0,
        loopEnabled: false, loopIntervalMs: 0, loopMaxIterations: 0,
      }),
      listTaskGroupItems: vi.fn().mockReturnValue([
        { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: null, onFailure: null },
        { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 1, onSuccess: null, onFailure: null },
        { id: 'i3', taskGroupId: 'g1', taskId: 't3', order: 2, onSuccess: null, onFailure: null },
      ]),
      createTaskGroupRun: vi.fn().mockReturnValue('grun-1'),
      updateTaskGroupRun: vi.fn(),
    };
    mockTaskEngine = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      getStatus: vi.fn().mockReturnValue('completed'),
    };
    engine = new TaskGroupEngine(mockStorage, mockTaskEngine);
  });

  it('follows onSuccess jump target', async () => {
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: 'i3', onFailure: null },
      { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 1, onSuccess: null, onFailure: null },
      { id: 'i3', taskGroupId: 'g1', taskId: 't3', order: 2, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus.mockReturnValue('completed');
    await engine.start('g1');
    // t1 succeeds -> jumps to i3 (t3) -> t3 succeeds -> ends
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(2);
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(1, 't1');
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(2, 't3');
  });

  it('follows onFailure jump target', async () => {
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: 'i2', onFailure: 'i3' },
      { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 1, onSuccess: null, onFailure: null },
      { id: 'i3', taskGroupId: 'g1', taskId: 't3', order: 2, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus
      .mockReturnValueOnce('failed')   // t1 fails -> jumps to i3
      .mockReturnValueOnce('completed'); // t3 succeeds -> ends
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(2);
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(1, 't1');
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(2, 't3');
  });

  it('END target stops the group', async () => {
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: 'END', onFailure: null },
      { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 1, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus.mockReturnValue('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(1);
    expect(mockTaskEngine.start).toHaveBeenCalledWith('t1');
  });

  it('null onFailure ends group on failure', async () => {
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: null, onFailure: null },
      { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 1, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus.mockReturnValueOnce('failed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(1);
  });

  it('loops the group N times', async () => {
    mockStorage.getTaskGroup.mockReturnValue({
      id: 'g1', name: 'Group', failurePolicy: 'STOP', retryCount: 0,
      loopEnabled: true, loopIntervalMs: 0, loopMaxIterations: 3,
    });
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus.mockReturnValue('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(3);
  });

  it('infinite loop stops on stop()', async () => {
    mockStorage.getTaskGroup.mockReturnValue({
      id: 'g1', name: 'Group', failurePolicy: 'STOP', retryCount: 0,
      loopEnabled: true, loopIntervalMs: 100, loopMaxIterations: 0,
    });
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus.mockReturnValue('completed');
    const promise = engine.start('g1');
    engine.stop('g1');
    await promise;
    // Should have run at least once but not infinitely
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(1);
  });

  it('non-looping group runs items once then ends', async () => {
    mockTaskEngine.getStatus.mockReturnValue('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/services/__tests__/task-group-engine-branching.test.ts --reporter=verbose`
Expected: FAIL — engine doesn't support branching or looping.

- [ ] **Step 3: Rewrite TaskGroupEngine**

Replace `src/main/services/task-group-engine.ts`:

```typescript
import type { TaskGroup, TaskGroupItem } from '@shared/types/task-group';
import type { StorageService } from './storage';
import type { TaskEngine } from './task-engine';

export class TaskGroupEngine {
  private storage: StorageService;
  private taskEngine: TaskEngine;
  private running = new Map<string, boolean>();

  constructor(storage: StorageService, taskEngine: TaskEngine) {
    this.storage = storage;
    this.taskEngine = taskEngine;
  }

  async start(taskGroupId: string): Promise<void> {
    const group = this.storage.getTaskGroup(taskGroupId);
    if (!group) throw new Error(`Task group not found: ${taskGroupId}`);

    const items = this.storage.listTaskGroupItems(taskGroupId);
    const runId = this.storage.createTaskGroupRun({ taskGroupId });
    const runLog: any[] = [];
    this.running.set(taskGroupId, true);

    const itemMap = new Map<string, TaskGroupItem>();
    for (const item of items) {
      itemMap.set(item.id, item);
    }

    let iteration = 0;
    while (this.shouldContinue(group.loopEnabled, group.loopMaxIterations, iteration, taskGroupId)) {
      await this.runGroupOnce(items, itemMap, taskGroupId, runLog);

      iteration++;
      if (group.loopEnabled && this.shouldContinue(group.loopEnabled, group.loopMaxIterations, iteration, taskGroupId)) {
        await this.delay(group.loopIntervalMs, taskGroupId);
      }
    }

    const result = this.running.get(taskGroupId) === false ? 'stopped' : 'completed';
    this.storage.updateTaskGroupRun(runId, {
      endedAt: new Date().toISOString(),
      result,
      log: runLog,
    });

    this.running.delete(taskGroupId);
  }

  stop(taskGroupId: string): void {
    this.running.set(taskGroupId, false);
  }

  private shouldContinue(
    loopEnabled: boolean,
    loopMaxIterations: number,
    iteration: number,
    taskGroupId: string,
  ): boolean {
    if (this.running.get(taskGroupId) === false) return false;
    if (!loopEnabled) return iteration === 0;
    if (loopMaxIterations === 0) return true; // infinite
    return iteration < loopMaxIterations;
  }

  private async runGroupOnce(
    items: TaskGroupItem[],
    itemMap: Map<string, TaskGroupItem>,
    taskGroupId: string,
    runLog: any[],
  ): Promise<void> {
    if (items.length === 0) return;

    let currentItem: TaskGroupItem | undefined = items[0];

    while (currentItem && this.running.get(taskGroupId) !== false) {
      await this.taskEngine.start(currentItem.taskId);
      const status = this.taskEngine.getStatus(currentItem.taskId);
      const success = status === 'completed';

      runLog.push({
        taskId: currentItem.taskId,
        success,
        timestamp: new Date().toISOString(),
      });

      const jumpTarget = success ? currentItem.onSuccess : currentItem.onFailure;

      if (jumpTarget === 'END') {
        break;
      } else if (jumpTarget === null) {
        if (success) {
          const currentIndex = items.indexOf(currentItem);
          currentItem = items[currentIndex + 1];
        } else {
          break;
        }
      } else {
        currentItem = itemMap.get(jumpTarget);
      }
    }
  }

  private async delay(ms: number, groupId: string): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      const check = setInterval(() => {
        if (!this.running.get(groupId)) {
          clearTimeout(timer);
          clearInterval(check);
          resolve();
        }
      }, 200);
    });
  }
}
```

- [ ] **Step 4: Run all engine tests to verify**

Run: `npx vitest run src/main/services/__tests__/task-group-engine.test.ts src/main/services/__tests__/task-group-engine-branching.test.ts --reporter=verbose`
Expected: All PASS. Old tests still pass because items have `onSuccess: null, onFailure: null` which defaults to linear behavior.

- [ ] **Step 5: Refactor**

Run full test suite to verify nothing else broke:

Run: `npx vitest run --reporter=verbose`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/task-group-engine.ts src/main/services/__tests__/task-group-engine-branching.test.ts
git commit -m "feat: TaskGroupEngine with conditional branching and loop control"
```

---

## Task 5: Chinese Localization (Right Panel)

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/Assistant/TaskList.tsx`
- Modify: `src/renderer/components/Assistant/TaskGroupList.tsx`
- Modify: `src/renderer/components/Assistant/TaskEditor.tsx`
- Modify: `src/renderer/components/Assistant/StepEditor.tsx`
- Modify: `src/renderer/components/Assistant/ExecutionStatus.tsx`
- Modify: `src/renderer/components/Tools/LogViewer.tsx`
- Modify: `src/renderer/components/Tools/ImageCompare.tsx`
- Modify: `src/renderer/components/Tools/ClickTest.tsx`
- Modify: `src/renderer/components/Network/NetworkLog.tsx`

- [ ] **Step 1: App.tsx — tab labels and buttons**

Replace in `src/renderer/App.tsx`:
- `'Assistant'` → `'辅助'`
- `'Tools'` → `'工具'`
- `'Network'` → `'网络'`
- `'Tasks'` → `'任务'`
- `'Groups'` → `'任务组'`

- [ ] **Step 2: TaskList.tsx — Chinese strings**

Replace in `src/renderer/components/Assistant/TaskList.tsx`:
- `'Delete?'` → `'确定删除？'`
- Status tag text: `idle` → `'空闲'`, `running` → `'运行中'`, `paused` → `'已暂停'`, `completed` → `'已完成'`, `failed` → `'失败'`, `stopped` → `'已停止'`

- [ ] **Step 3: TaskGroupList.tsx — Chinese strings**

Replace in `src/renderer/components/Assistant/TaskGroupList.tsx`:
- `'New Group'` → `'新建任务组'`
- `'Delete?'` → `'确定删除？'`
- `'Failed to load task groups.'` → `'加载任务组失败。'`
- `'Failed to create task group.'` → `'创建任务组失败。'`
- `'Failed to delete task group.'` → `'删除任务组失败。'`
- `'Failed to start task group.'` → `'启动任务组失败。'`
- `'Failed to stop task group.'` → `'停止任务组失败。'`
- `'New Task Group'` → `'新建任务组'`
- `'Name'` → `'名称'`
- `'Failure Policy'` → `'失败策略'`
- `'Stop'` → `'停止'`, `'Skip'` → `'跳过'`, `'Retry'` → `'重试'`

- [ ] **Step 4: TaskEditor.tsx — Chinese strings**

Replace in `src/renderer/components/Assistant/TaskEditor.tsx`:
- `'Edit Task: '` → `'编辑任务: '`
- `'Close'` → `'关闭'`
- `'Name'` → `'名称'`
- `'Save Task'` → `'保存任务'`
- `'Steps'` → `'步骤'`
- `'Add Step'` → `'添加步骤'`
- `'Failed to load task data.'` → `'加载任务数据失败。'`
- `'Failed to save task.'` → `'保存任务失败。'`
- `'Task saved.'` → `'任务已保存。'`
- `'Failed to save step.'` → `'保存步骤失败。'`
- `'Step saved.'` → `'步骤已保存。'`
- `'Failed to delete step.'` → `'删除步骤失败。'`
- `'Delete?'` → `'确定删除？'`

- [ ] **Step 5: StepEditor.tsx — Chinese strings**

Replace in `src/renderer/components/Assistant/StepEditor.tsx`:
- All form labels: `'Type'` → `'类型'`, `'Template Path'` → `'模板路径'`, `'Threshold'` → `'阈值'`, etc.
- Step type options: `'IMAGE_MATCH'` → `'图像匹配'`, `'IMAGE_GROUP'` → `'图像组'`, `'CLICK'` → `'点击'`
- Action labels: `'END_TASK'` → `'结束任务'`, `'END_GROUP_LOOP'` → `'结束组循环'`, `'NEXT'` → `'下一步'`
- `'On Match'` → `'匹配时'`, `'On Miss'` → `'未匹配时'`
- `'Save'` → `'保存'`, `'Cancel'` → `'取消'`

- [ ] **Step 6: ExecutionStatus.tsx — Chinese strings**

Replace in `src/renderer/components/Assistant/ExecutionStatus.tsx`:
- `'MATCH'` → `'匹配'`, `'MISS'` → `'未匹配'`
- Status labels if any

- [ ] **Step 7: LogViewer.tsx — Chinese strings**

Replace in `src/renderer/components/Tools/LogViewer.tsx`:
- Column headers: `'Time'` → `'时间'`, `'Level'` → `'级别'`, `'Source'` → `'来源'`, `'Message'` → `'消息'`
- `'Debug'` → `'调试'`
- `'Clear'` → `'清空'`, `'Export'` → `'导出'`
- Filter labels

- [ ] **Step 8: ImageCompare.tsx — Chinese strings**

Replace in `src/renderer/components/Tools/ImageCompare.tsx`:
- `'Upload Screenshot'` → `'上传截图'`, `'Upload Template'` → `'上传模板'`
- `'Compare'` → `'对比'`
- Result labels

- [ ] **Step 9: ClickTest.tsx — Chinese strings**

Replace in `src/renderer/components/Tools/ClickTest.tsx`:
- `'X'` → `'X坐标'`, `'Y'` → `'Y坐标'`
- `'Button'` → `'按键'`, `'Count'` → `'次数'`
- `'Click'` → `'点击'`

- [ ] **Step 10: NetworkLog.tsx — Chinese strings**

Replace in `src/renderer/components/Network/NetworkLog.tsx`:
- Column headers, filter labels, button labels

- [ ] **Step 11: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All PASS. (UI string changes don't affect test logic.)

- [ ] **Step 12: Commit**

```bash
git add src/renderer/
git commit -m "feat: Chinese localization for all right-panel components"
```

---

## Task 6: TaskGroupEditor Redesign

**Files:**
- Modify: `src/renderer/components/Assistant/TaskGroupEditor.tsx`
- Modify: `package.json` (new dependencies)

- [ ] **Step 1: Install dependencies**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Write the component**

Replace `src/renderer/components/Assistant/TaskGroupEditor.tsx` with the redesigned component that includes:

1. **Basic info section**: Name input, save button (Chinese labels)
2. **Loop settings section**: Switch for enable, InputNumber for interval (minutes), InputNumber for max iterations, save button
3. **Task orchestration section**: DndContext + SortableContext wrapping a list of SortableItem components
4. **Each item**: Drag handle (☰), order number, task name, delete button, two Select dropdowns for success/failure jump targets
5. **Jump target Select options**: "结束" (END) + all other items by name (excluding self)
6. **Add task**: Select dropdown with available tasks

Key implementation details:
- Use `useSortable` from @dnd-kit/sortable for each item
- On drag end, call `TASK_GROUP_REORDER_ITEMS` IPC
- On jump target change, call `TASK_GROUP_UPDATE_ITEM_TARGET` IPC
- On loop settings save, call `TASK_GROUP_UPDATE_LOOP` IPC
- All text in Chinese

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Assistant/TaskGroupEditor.tsx package.json package-lock.json
git commit -m "feat: TaskGroupEditor with drag-and-drop, conditional jumps, loop settings"
```

---

## Task 7: Integration Verification

**Files:** None (manual testing)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run --reporter=verbose`
Expected: All PASS.

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`

Verify:
1. All right-panel text is Chinese
2. Create a task group, add 3 tasks
3. Set success/failure jump targets per item
4. Enable looping (interval: 5 seconds, max: 2 iterations)
5. Drag to reorder tasks
6. Run the group and verify branching works
7. Verify loop repeats
8. Verify stop interrupts execution

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: enhance right panel with Chinese UI and task group orchestration"
```
