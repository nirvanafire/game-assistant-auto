# 增强步骤编辑器与步骤组管理 实现计划

> **致自动化执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 来逐任务执行本计划。步骤使用 checkbox（`- [ ]`）语法跟踪。

**目标：** 统一编辑入口、模板图片持久化、开关横排布局、IMAGE_GROUP 编辑器、转场默认值语义、步骤组管理 UI。

**架构：** 改动集中在渲染层（StepEditor、TaskEditor、列表组件、App.tsx）、主进程服务（template-storage、task-engine、storage、IPC）、共享类型和数据库迁移。模板图片通过新的 `template-storage` 服务管理；步骤组 CRUD 通过新 IPC 通道暴露；引擎语义从"undefined=推进"改为"undefined=停止"并通过 migration v4 回填现有数据保持行为一致。

**技术栈：** Electron, TypeScript, React 19, Ant Design 6, better-sqlite3, Vitest

---

## 文件结构

### 新增文件
- `src/main/services/template-storage.ts` — 模板图片管理服务（目录初始化、路径归一化、文件复制）
- `src/main/services/__tests__/template-storage.test.ts` — 单元测试
- `src/main/ipc/image.ts` — 图片相关 IPC 处理器（image:pick, image:normalize）
- `src/main/ipc/step-group.ts` — 步骤组 IPC 处理器
- `src/main/ipc/__tests__/image-ipc.test.ts` — 图片 IPC 测试
- `src/main/ipc/__tests__/step-group-ipc.test.ts` — 步骤组 IPC 测试
- `src/renderer/components/Assistant/StepGroupCard.tsx` — 步骤组卡片组件

### 修改文件
- `src/shared/types/task.ts` — StepTransition.action 新增 `'NEXT_STEP'`
- `src/shared/constants.ts` — 新增 IPC 通道常量
- `src/main/db/migrations.ts` — 新增 migration v4
- `src/main/db/schema.ts` — schema 版本更新到 4
- `src/main/services/task-engine.ts` — NEXT_STEP 分支 + undefined 停止语义
- `src/main/services/storage.ts` — 新增步骤组 CRUD 方法
- `src/main/index.ts` — 注册新 IPC 处理器、初始化 template-storage
- `src/main/ipc/task.ts` — 注册步骤组 IPC 处理器
- `src/renderer/App.tsx` — 移除 task-editor/group-editor 视图分支
- `src/renderer/components/Assistant/StepEditor.tsx` — 开关横排、IMAGE_GROUP 编辑器、图片选择按钮、NEXT_STEP 选项、新默认值
- `src/renderer/components/Assistant/TaskEditor.tsx` — 步骤组管理 UI
- `src/renderer/components/Assistant/TaskList.tsx` — 移除 onEdit prop、清理 Drawer 逻辑
- `src/renderer/components/Assistant/TaskGroupList.tsx` — 移除 onEdit prop、清理 Drawer 逻辑

---

## Task 1: 共享类型 — NEXT_STEP 转场动作

**文件：**
- 修改：`src/shared/types/task.ts`
- 测试：`src/shared/types/__tests__/task-types.test.ts`（已有，更新）

- [ ] **Step 1: 更新测试**

在 `src/shared/types/__tests__/task-types.test.ts` 中添加：

```typescript
it('StepTransition includes NEXT_STEP action', () => {
  const transition: StepTransition = { action: 'NEXT_STEP' };
  expect(transition.action).toBe('NEXT_STEP');
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/shared/types/__tests__/task-types.test.ts`
预期：FAIL — `'NEXT_STEP'` 不在 StepTransition.action 的联合类型中

- [ ] **Step 3: 实现**

修改 `src/shared/types/task.ts` 中的 `StepTransition`：

```typescript
export interface StepTransition {
  nextStepId?: string;
  action?: 'NEXT_STEP' | 'END_TASK' | 'END_STEP_GROUP';
}
```

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/shared/types/__tests__/task-types.test.ts`
预期：PASS

- [ ] **Step 5: 提交**

```bash
git add src/shared/types/task.ts src/shared/types/__tests__/task-types.test.ts
git commit -m "feat: add NEXT_STEP action to StepTransition"
```

---

## Task 2: IPC 通道常量 + 步骤组存储方法

**文件：**
- 修改：`src/shared/constants.ts`
- 修改：`src/main/services/storage.ts`

- [ ] **Step 1: 添加 IPC 通道常量**

在 `src/shared/constants.ts` 的 `IPC_CHANNELS` 对象中添加：

```typescript
  IMAGE_PICK: 'image:pick',
  IMAGE_NORMALIZE: 'image:normalize',
  STEP_GROUP_LIST: 'step-group:list',
  STEP_GROUP_CREATE: 'step-group:create',
  STEP_GROUP_UPDATE: 'step-group:update',
  STEP_GROUP_DELETE: 'step-group:delete',
```

- [ ] **Step 2: 在 StorageService 中添加步骤组 CRUD 方法**

在 `src/main/services/storage.ts` 的 `StorageService` 类中添加：

```typescript
  listStepGroupsByTask(taskId: string): StepGroup[] {
    return this.db.prepare(
      'SELECT * FROM step_groups WHERE task_id = ? ORDER BY id'
    ).all(taskId) as any[];
  }

  createStepGroup(data: { taskId: string; name: string; loopCount: number }): StepGroup {
    const id = uuidv4();
    this.db.prepare(
      'INSERT INTO step_groups (id, task_id, name, loop_count) VALUES (?, ?, ?, ?)'
    ).run(id, data.taskId, data.name, data.loopCount);
    return { id, taskId: data.taskId, name: data.name, loopCount: data.loopCount };
  }

  updateStepGroup(id: string, patch: Partial<Pick<StepGroup, 'name' | 'loopCount'>>): void {
    const existing = this.db.prepare('SELECT * FROM step_groups WHERE id = ?').get(id) as any;
    if (!existing) return;
    this.db.prepare(
      'UPDATE step_groups SET name = ?, loop_count = ? WHERE id = ?'
    ).run(
      patch.name ?? existing.name,
      patch.loopCount ?? existing.loop_count,
      id,
    );
  }

  deleteStepGroup(id: string): void {
    // Ungroup steps first
    this.db.prepare(
      'UPDATE steps SET group_id = NULL WHERE group_id = ?'
    ).run(id);
    this.db.prepare(
      'DELETE FROM step_groups WHERE id = ?'
    ).run(id);
  }
```

- [ ] **Step 3: 提交**

```bash
git add src/shared/constants.ts src/main/services/storage.ts
git commit -m "feat: add IPC channel constants and step-group CRUD in StorageService"
```

---

## Task 3: 模板图片管理服务

**文件：**
- 创建：`src/main/services/template-storage.ts`
- 测试：`src/main/services/__tests__/template-storage.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
// src/main/services/__tests__/template-storage.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TemplateStorage } from '../template-storage';

describe('TemplateStorage', () => {
  let storage: TemplateStorage;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
    storage = new TemplateStorage(tempDir);
    storage.init();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('init creates the templates directory', () => {
    expect(fs.existsSync(path.join(tempDir, 'templates'))).toBe(true);
  });

  it('isManaged returns true for paths inside templates/', () => {
    const managed = path.join(tempDir, 'templates', 'abc.png');
    expect(storage.isManaged(managed)).toBe(true);
  });

  it('isManaged returns false for external paths', () => {
    expect(storage.isManaged('C:/users/alice/desktop/btn.png')).toBe(false);
  });

  it('normalize copies external file with UUID filename', async () => {
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
    const srcFile = path.join(srcDir, 'button.png');
    fs.writeFileSync(srcFile, 'fake-png-data');

    const saved = await storage.normalize(srcFile);
    expect(saved).toMatch(/templates\/[a-f0-9-]+\.png$/);
    expect(fs.existsSync(saved)).toBe(true);
    expect(fs.readFileSync(saved, 'utf-8')).toBe('fake-png-data');

    fs.rmSync(srcDir, { recursive: true, force: true });
  });

  it('normalize returns same path for already managed file', async () => {
    const managed = path.join(tempDir, 'templates', 'existing.png');
    fs.writeFileSync(managed, 'data');
    const result = await storage.normalize(managed);
    expect(result).toBe(managed);
  });

  it('normalize rejects for missing file', async () => {
    await expect(storage.normalize('/nonexistent/file.png')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/main/services/__tests__/template-storage.test.ts`
预期：FAIL — `template-storage` 模块不存在

- [ ] **Step 3: 实现**

```typescript
// src/main/services/template-storage.ts
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class TemplateStorage {
  private templatesDir: string;

  constructor(userDataPath: string) {
    this.templatesDir = path.join(userDataPath, 'templates');
  }

  init(): void {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }
  }

  isManaged(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    return resolved.startsWith(this.templatesDir);
  }

  async normalize(sourcePath: string): Promise<string> {
    const resolved = path.resolve(sourcePath);
    if (this.isManaged(resolved)) {
      return resolved;
    }

    if (!fs.existsSync(resolved)) {
      throw new Error(`Source file not found: ${resolved}`);
    }

    const ext = path.extname(resolved);
    const newName = `${uuidv4()}${ext}`;
    const dest = path.join(this.templatesDir, newName);
    fs.copyFileSync(resolved, dest);
    return dest;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/main/services/__tests__/template-storage.test.ts`
预期：PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/services/template-storage.ts src/main/services/__tests__/template-storage.test.ts
git commit -m "feat: add TemplateStorage service for image persistence"
```

---

## Task 4: 图片与步骤组 IPC 处理器

**文件：**
- 创建：`src/main/ipc/image.ts`
- 创建：`src/main/ipc/step-group.ts`
- 修改：`src/main/index.ts`（注册处理器）
- 测试：`src/main/ipc/__tests__/image-ipc.test.ts`

- [ ] **Step 1: 编写图片 IPC 测试**

```typescript
// src/main/ipc/__tests__/image-ipc.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createImageIpcHandlers } from '../image';

describe('Image IPC handlers', () => {
  let mockRegistry: any;
  let mockTemplateStorage: any;
  let handlers: Record<string, Function>;

  beforeEach(() => {
    handlers = {};
    mockRegistry = {
      handle: vi.fn((channel: string, handler: Function) => {
        handlers[channel] = handler;
      }),
    };
    mockTemplateStorage = {
      normalize: vi.fn().mockResolvedValue('/templates/abc.png'),
    };
    createImageIpcHandlers(mockRegistry, mockTemplateStorage);
  });

  it('registers image:pick handler', () => {
    expect(handlers['image:pick']).toBeDefined();
  });

  it('registers image:normalize handler', () => {
    expect(handlers['image:normalize']).toBeDefined();
  });

  it('image:normalize delegates to templateStorage.normalize', async () => {
    const result = await handlers['image:normalize']({}, { sourcePath: '/ext/file.png' });
    expect(mockTemplateStorage.normalize).toHaveBeenCalledWith('/ext/file.png');
    expect(result).toEqual({ savedPath: '/templates/abc.png' });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/main/ipc/__tests__/image-ipc.test.ts`
预期：FAIL — `image` 模块不存在

- [ ] **Step 3: 实现图片 IPC**

```typescript
// src/main/ipc/image.ts
import { dialog } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import type { TemplateStorage } from '../services/template-storage';
import type { IpcRegistry } from './registry';

export function createImageIpcHandlers(
  registry: IpcRegistry,
  templateStorage: TemplateStorage,
): void {
  registry.handle(IPC_CHANNELS.IMAGE_PICK, async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { sourcePath: null };
    }
    return { sourcePath: result.filePaths[0] };
  });

  registry.handle(IPC_CHANNELS.IMAGE_NORMALIZE, async (_event: any, args: { sourcePath: string }) => {
    const savedPath = await templateStorage.normalize(args.sourcePath);
    return { savedPath };
  });
}
```

- [ ] **Step 4: 实现步骤组 IPC**

```typescript
// src/main/ipc/step-group.ts
import { IPC_CHANNELS } from '@shared/constants';
import type { StorageService } from '../services/storage';
import type { IpcRegistry } from './registry';

export function createStepGroupIpcHandlers(
  registry: IpcRegistry,
  storage: StorageService,
): void {
  registry.handle(IPC_CHANNELS.STEP_GROUP_LIST, (_event: any, args: { taskId: string }) => {
    return { groups: storage.listStepGroupsByTask(args.taskId) };
  });

  registry.handle(IPC_CHANNELS.STEP_GROUP_CREATE, (_event: any, args: { taskId: string; name: string; loopCount: number }) => {
    const group = storage.createStepGroup(args);
    return { group };
  });

  registry.handle(IPC_CHANNELS.STEP_GROUP_UPDATE, (_event: any, args: { stepGroupId: string; patch: { name?: string; loopCount?: number } }) => {
    storage.updateStepGroup(args.stepGroupId, args.patch);
  });

  registry.handle(IPC_CHANNELS.STEP_GROUP_DELETE, (_event: any, args: { stepGroupId: string }) => {
    storage.deleteStepGroup(args.stepGroupId);
  });
}
```

- [ ] **Step 5: 在 main/index.ts 中注册**

在 `src/main/index.ts` 中：
1. 在 `app.whenReady()` 内、创建 `StorageService` 之后，创建 `TemplateStorage` 实例并调用 `init()`
2. 调用 `createImageIpcHandlers(registry, templateStorage)`
3. 调用 `createStepGroupIpcHandlers(registry, storage)`

- [ ] **Step 6: 运行测试确认通过**

运行：`npx vitest run src/main/ipc/__tests__/image-ipc.test.ts`
预期：PASS

- [ ] **Step 7: 提交**

```bash
git add src/main/ipc/image.ts src/main/ipc/step-group.ts src/main/index.ts src/main/ipc/__tests__/image-ipc.test.ts
git commit -m "feat: add image and step-group IPC handlers"
```

---

## Task 5: Migration v4 — 回填转场动作

**文件：**
- 修改：`src/main/db/migrations.ts`
- 修改：`src/main/db/schema.ts`
- 测试：`src/main/db/__tests__/migration-v4.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
// src/main/db/__tests__/migration-v4.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../schema';
import { runMigrations, getCurrentVersion } from '../migrations';

describe('Migration v4', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    // Run up to v3 first
    runMigrations(db);
  });

  it('backfills empty on_match for IMAGE_MATCH to NEXT_STEP', () => {
    const taskId = 't1';
    db.prepare(
      "INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)"
    ).run(taskId, 'Test', 'idle', '{}', '[]');
    db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('s1', taskId, 'IMAGE_MATCH', 1, '{}', '{}', '{}', 0, 0, 0);

    runMigrations(db);

    const row = db.prepare('SELECT on_match FROM steps WHERE id = ?').get('s1') as any;
    expect(JSON.parse(row.on_match)).toEqual({ action: 'NEXT_STEP' });
  });

  it('backfills empty on_miss for IMAGE_GROUP to NEXT_STEP', () => {
    const taskId = 't1';
    db.prepare(
      "INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)"
    ).run(taskId, 'Test', 'idle', '{}', '[]');
    db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('s1', taskId, 'IMAGE_GROUP', 1, '{}', '{}', '{}', 0, 0, 0);

    runMigrations(db);

    const row = db.prepare('SELECT on_miss FROM steps WHERE id = ?').get('s1') as any;
    expect(JSON.parse(row.on_miss)).toEqual({ action: 'NEXT_STEP' });
  });

  it('does not modify CLICK rows', () => {
    const taskId = 't1';
    db.prepare(
      "INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)"
    ).run(taskId, 'Test', 'idle', '{}', '[]');
    db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('s1', taskId, 'CLICK', 1, '{}', '{}', '{}', 0, 0, 0);

    runMigrations(db);

    const row = db.prepare('SELECT on_match FROM steps WHERE id = ?').get('s1') as any;
    expect(row.on_match).toBe('{}');
  });

  it('does not modify rows with existing action', () => {
    const taskId = 't1';
    db.prepare(
      "INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)"
    ).run(taskId, 'Test', 'idle', '{}', '[]');
    db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('s1', taskId, 'IMAGE_MATCH', 1, '{}', '{"action":"END_TASK"}', '{}', 0, 0, 0);

    runMigrations(db);

    const row = db.prepare('SELECT on_match FROM steps WHERE id = ?').get('s1') as any;
    expect(JSON.parse(row.on_match)).toEqual({ action: 'END_TASK' });
  });

  it('does not modify rows with nextStepId', () => {
    const taskId = 't1';
    db.prepare(
      "INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)"
    ).run(taskId, 'Test', 'idle', '{}', '[]');
    db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('s1', taskId, 'IMAGE_MATCH', 1, '{}', '{"nextStepId":"s3"}', '{}', 0, 0, 0);

    runMigrations(db);

    const row = db.prepare('SELECT on_match FROM steps WHERE id = ?').get('s1') as any;
    expect(JSON.parse(row.on_match)).toEqual({ nextStepId: 's3' });
  });

  it('updates schema version to 4', () => {
    runMigrations(db);
    expect(getCurrentVersion(db)).toBe(4);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/main/db/__tests__/migration-v4.test.ts`
预期：FAIL — migration v4 不存在

- [ ] **Step 3: 实现 migration v4**

在 `src/main/db/migrations.ts` 的 migrations 数组末尾添加：

```typescript
  {
    version: 4,
    up: (db: Database.Database) => {
      db.exec(`
        UPDATE steps
        SET on_match = '{"action":"NEXT_STEP"}'
        WHERE type IN ('IMAGE_MATCH', 'IMAGE_GROUP')
          AND (
            on_match IS NULL
            OR on_match = ''
            OR on_match = '{}'
            OR (json_extract(on_match, '$.action') IS NULL AND json_extract(on_match, '$.nextStepId') IS NULL)
          );
      `);
      db.exec(`
        UPDATE steps
        SET on_miss = '{"action":"NEXT_STEP"}'
        WHERE type IN ('IMAGE_MATCH', 'IMAGE_GROUP')
          AND (
            on_miss IS NULL
            OR on_miss = ''
            OR on_miss = '{}'
            OR (json_extract(on_miss, '$.action') IS NULL AND json_extract(on_miss, '$.nextStepId') IS NULL)
          );
      `);
    },
  },
```

在 `src/main/db/schema.ts` 中将 `INSERT OR IGNORE INTO schema_version (version) VALUES (3)` 改为 `VALUES (4)`。

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/main/db/__tests__/migration-v4.test.ts`
预期：PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/db/migrations.ts src/main/db/schema.ts src/main/db/__tests__/migration-v4.test.ts
git commit -m "feat: add migration v4 to backfill NEXT_STEP transitions"
```

---

## Task 6: TaskEngine — NEXT_STEP + undefined 停止语义

**文件：**
- 修改：`src/main/services/task-engine.ts`
- 测试：`src/main/services/__tests__/transition-semantics.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
// src/main/services/__tests__/transition-semantics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEngine } from '../task-engine';

describe('TaskEngine transition semantics', () => {
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

  it('NEXT_STEP advances to next ordered step', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/a.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'NEXT_STEP' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'IMAGE_MATCH', order: 2, config: { templatePath: '/b.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    expect(mockMatcher.match).toHaveBeenCalledTimes(2);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('undefined onMatch halts the task on success', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/a.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: undefined, onMiss: undefined, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'IMAGE_MATCH', order: 2, config: { templatePath: '/b.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    // s1 matches but onMatch is undefined → halt, s2 never runs
    expect(mockMatcher.match).toHaveBeenCalledTimes(1);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('undefined onMiss halts the task on failure', async () => {
    mockMatcher.match.mockResolvedValueOnce({ matched: false });
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/a.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'NEXT_STEP' }, onMiss: undefined, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'IMAGE_MATCH', order: 2, config: { templatePath: '/b.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    // s1 misses, onMiss undefined → halt, s2 never runs
    expect(mockMatcher.match).toHaveBeenCalledTimes(1);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('CLICK still advances regardless of transitions', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/a.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, config: { source: 'from_step', stepId: 's1', clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
      { id: 's3', taskId: 't1', type: 'IMAGE_MATCH', order: 3, config: { templatePath: '/b.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledTimes(1);
    expect(mockMatcher.match).toHaveBeenCalledTimes(2);
    expect(engine.getStatus('t1')).toBe('completed');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/main/services/__tests__/transition-semantics.test.ts`
预期：FAIL — 当前引擎对 undefined 转场仍执行 stepIndex++

- [ ] **Step 3: 修改 TaskEngine 引擎逻辑**

修改 `src/main/services/task-engine.ts` 中处理转场的逻辑。核心改动：

在非组步骤的转场处理中（当前是 `else` 分支），将：

```typescript
if (transition?.action === 'END_TASK') { ... }
if (transition?.nextStepId) { ... }
else { stepIndex++; }
```

改为：

```typescript
if (transition?.action === 'END_TASK') {
  this.statuses.set(taskId, 'completed');
  return;
}
if (transition?.action === 'NEXT_STEP') {
  stepIndex++;
  continue;
}
if (transition?.nextStepId) {
  stepIndex = steps.findIndex(s => s.id === transition.nextStepId);
  if (stepIndex === -1) {
    this.statuses.set(taskId, 'completed');
    return;
  }
} else {
  // undefined transition = halt
  this.statuses.set(taskId, 'completed');
  return;
}
```

组内步骤的转场处理同样调整：`NEXT_STEP` 推进到组内下一步（`gsi++`），undefined 停止任务。

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/main/services/__tests__/transition-semantics.test.ts`
预期：PASS

- [ ] **Step 5: 运行全部 TaskEngine 测试确认无回归**

运行：`npx vitest run src/main/services/__tests__/`
预期：ALL PASS

- [ ] **Step 6: 提交**

```bash
git add src/main/services/task-engine.ts src/main/services/__tests__/transition-semantics.test.ts
git commit -m "feat: implement NEXT_STEP and undefined-halt transition semantics"
```

---

## Task 7: StepEditor — 开关横排、IMAGE_GROUP 编辑器、图片选择、转场默认值

**文件：**
- 修改：`src/renderer/components/Assistant/StepEditor.tsx`

本任务是最大的渲染层改动。按子功能拆分为步骤。

- [ ] **Step 1: 更新 STEP_TYPE_LABELS 和 TRANSITION_ACTIONS**

将类型 Select 的标签从 `'IMAGE_GROUP' → '图像组'` 改为 `'IMAGE_GROUP' → '图像组匹配'`。

更新 TRANSITION_ACTIONS：
```typescript
const TRANSITION_ACTIONS = [
  { label: '（无）', value: undefined },
  { label: '下一个步骤', value: 'NEXT_STEP' },
  { label: '结束任务', value: 'END_TASK' },
  { label: '结束步骤组', value: 'END_STEP_GROUP' },
];
```

- [ ] **Step 2: 开关横排布局**

将三个开关（screenshotBeforeMatch、realtimeMatch、cacheCoordinates）用 `<Space style={{ width: '100%' }}>` 横排包裹，每个 `Form.Item` 设 `style={{ flex: 1 }}`。将 `cacheCoordinates` 的条件渲染从仅 IMAGE_MATCH 扩展为 IMAGE_MATCH 和 IMAGE_GROUP 共享。

- [ ] **Step 3: CLICK 类型隐藏全部开关和转场卡片**

将现有"仅 CLICK 隐藏转场卡片"的逻辑扩展为 CLICK 同时隐藏三个开关。用一个 `shouldUpdate` 条件包裹整个"开关行 + 转场卡片"区域。

- [ ] **Step 4: 更新 initialValues 默认值**

新建步骤时：
- `cacheCoordinates: true`（原为 false）
- `onMatchAction: 'NEXT_STEP'`（原为 undefined）
- `onMissAction: undefined`（保持不变）

- [ ] **Step 5: 实现 IMAGE_GROUP 编辑器**

新增 `ImageGroupFields` 内部组件，使用 antd `Form.List` 渲染模板列表，每项含：
- `label`：Input
- `templatePath`：Input + "选择图片"按钮
- `threshold`：InputNumber (0-1)

底部有"+ 添加模板"按钮。至少保留 1 项不可删除。

在模板列表上方添加 `logic` Radio.Group（ALL/ANY）。

在模板列表下方添加共享的 `delayMs`、`retryCount`、`retryIntervalMs`、`scaleRange` 字段。

更新 `buildConfig` 函数，IMAGE_GROUP 分支返回从表单收集的 `templates` 数组和 `logic` 值。

- [ ] **Step 6: 实现图片选择按钮**

在 `ImageMatchFields` 和 `ImageGroupFields` 中，每个 `templatePath` 输入框旁添加"选择图片"按钮。

按钮点击流程：
1. 调用 `window.electronAPI.invoke('image:pick')` 获取 `{ sourcePath }`
2. 如果 sourcePath 为 null（用户取消），返回
3. 调用 `window.electronAPI.invoke('image:normalize', { sourcePath })` 获取 `{ savedPath }`
4. 将 savedPath 写入对应的 `templatePath` 表单字段

- [ ] **Step 7: 实现保存时归一化**

修改 `handleSubmit` 为 async 函数。在调用 `onSave` 之前：
1. 从 `values` 中收集所有 `templatePath` 值（IMAGE_MATCH: `values.templatePath` 单个；IMAGE_GROUP: `values.templates[].templatePath` 数组）
2. 对每个路径调用 `window.electronAPI.invoke('image:normalize', { sourcePath })` 并 `await` 结果
3. 如果任何调用失败（catch），在对应模板路径字段上调用 `form.setFields([{ name, errors: ['文件不存在或无法复制'] }])`，return 不调用 `onSave`
4. 全部成功后，用返回的 `savedPath` 更新 `values` 对象中对应的路径字段，然后调用 `onSave`

- [ ] **Step 8: 提交**

```bash
git add src/renderer/components/Assistant/StepEditor.tsx
git commit -m "feat: overhaul StepEditor with horizontal toggles, IMAGE_GROUP editor, image picker, NEXT_STEP defaults"
```

---

## Task 8: TaskEditor — 步骤组管理

**文件：**
- 创建：`src/renderer/components/Assistant/StepGroupCard.tsx`
- 修改：`src/renderer/components/Assistant/TaskEditor.tsx`

- [ ] **Step 1: 实现 StepGroupCard 组件**

新建 `src/renderer/components/Assistant/StepGroupCard.tsx`：

```typescript
import React from 'react';
import { Card, Tag, Button, Space, Popconfirm, List } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { StepGroup, Step } from '@shared/types/task';

interface StepGroupCardProps {
  group: StepGroup;
  steps: Step[];
  onEditGroup: (group: StepGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddStep: (groupId: string) => void;
  onEditStep: (step: Step) => void;
  onDeleteStep: (stepId: string) => void;
  children?: React.ReactNode;
}

export const StepGroupCard: React.FC<StepGroupCardProps> = ({
  group, steps, onEditGroup, onDeleteGroup, onAddStep, onEditStep, onDeleteStep, children,
}) => {
  const loopLabel = group.loopCount === 0 ? '循环 ∞' : `循环 ×${group.loopCount}`;

  return (
    <Card
      size="small"
      title={
        <Space>
          {group.name}
          <Tag color="blue">{loopLabel}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => onEditGroup(group)} />
          <Popconfirm title="确定删除该步骤组？组内步骤将变为未分组。" onConfirm={() => onDeleteGroup(group.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      }
      style={{ marginBottom: 8 }}
    >
      {steps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 16, color: '#999' }}>
          暂无步骤
        </div>
      ) : (
        steps.map(step => (
          <div key={step.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <span>{step.type} — {step.order}</span>
            <Space>
              <Button size="small" onClick={() => onEditStep(step)}>编辑</Button>
              <Popconfirm title="确定删除？" onConfirm={() => onDeleteStep(step.id)}>
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            </Space>
          </div>
        ))
      )}
      {children}
      <Button icon={<PlusOutlined />} size="small" type="dashed" block style={{ marginTop: 8 }} onClick={() => onAddStep(group.id)}>
        在该组添加步骤
      </Button>
    </Card>
  );
};
```

- [ ] **Step 2: 更新 TaskEditor 加载步骤组**

在 TaskEditor 中新增状态 `stepGroups: StepGroup[]`，在加载步骤的同时调用 `step-group:list` 加载步骤组。

- [ ] **Step 3: 实现步骤组 CRUD UI**

添加"+ 添加步骤组"按钮和创建/编辑 Modal（name + loopCount 字段）。编辑复用同一个 Modal，预填当前值。

- [ ] **Step 4: 按组分区展示步骤**

将步骤列表改为：
1. 按 `groupId` 分组
2. 有 groupId 的步骤用 `StepGroupCard` 渲染
3. 无 groupId 的步骤集中显示在"（未分组）"区域
4. 组按成员步骤的最小 order 排序
5. 空组渲染在末尾

- [ ] **Step 5: 传入 groupId 到 StepEditor**

"+ 添加步骤"按钮（工具栏）创建步骤时 `groupId` 为 undefined。"+ 在该组添加步骤"按钮传入对应组的 id。

- [ ] **Step 6: 每次增删改后重新加载**

在 create/update/delete group 和 create/update/delete step 的回调中，重新加载步骤组列表和步骤列表。

- [ ] **Step 7: 提交**

```bash
git add src/renderer/components/Assistant/StepGroupCard.tsx src/renderer/components/Assistant/TaskEditor.tsx
git commit -m "feat: add step group management UI to TaskEditor"
```

---

## Task 9: App.tsx + 列表组件 — 移除全屏编辑器视图

**文件：**
- 修改：`src/renderer/App.tsx`
- 修改：`src/renderer/components/Assistant/TaskList.tsx`
- 修改：`src/renderer/components/Assistant/TaskGroupList.tsx`

- [ ] **Step 1: App.tsx 移除 task-editor/group-editor 视图**

从 `AssistantView` 类型中删除 `'task-editor'` 和 `'group-editor'`。移除 `renderAssistantContent()` 中对应的 case 分支。移除 `editingTaskId` 和 `editingGroupId` 状态。

顶部栏仅保留 `'tasks'` 和 `'groups'` 两个按钮。

- [ ] **Step 2: TaskList 移除 onEdit prop**

从 `TaskListProps` 中移除 `onEdit`。编辑按钮的 onClick 直接调用 `setDrawerTaskId(taskId)`（已有的逻辑）。双击同理。移除对 `onEdit` 的调用。

- [ ] **Step 3: TaskGroupList 移除 onEdit prop**

与 TaskList 同理，从 `TaskGroupListProps` 中移除 `onEdit`。编辑按钮和双击统一调用 `setDrawerGroupId(groupId)`。

- [ ] **Step 4: 运行 build 验证**

运行：`npm run build`
预期：BUILD SUCCESS

- [ ] **Step 5: 提交**

```bash
git add src/renderer/App.tsx src/renderer/components/Assistant/TaskList.tsx src/renderer/components/Assistant/TaskGroupList.tsx
git commit -m "feat: remove full-panel editor views, unify edit entry via Drawer"
```

---

## Task 10: 最终集成验证

- [ ] **Step 1: 运行全部测试**

运行：`npx vitest run`
预期：ALL PASS

- [ ] **Step 2: 构建验证**

运行：`npm run build`
预期：BUILD SUCCESS

- [ ] **Step 3: 手动验证清单**

- [ ] 双击任务列表中的任务 → Drawer 打开，显示 TaskEditor
- [ ] 点击编辑按钮 → 同一个 Drawer 打开
- [ ] 双击任务组列表中的任务组 → Drawer 打开，显示 TaskGroupEditor
- [ ] 顶部栏只有"任务"和"任务组"两个按钮
- [ ] 创建 IMAGE_MATCH 步骤 → 三个开关水平排列，缓存坐标默认开启
- [ ] 创建 CLICK 步骤 → 不显示开关和转场卡片
- [ ] 创建 IMAGE_MATCH 步骤 → 转场匹配时默认"下一个步骤"，未匹配时默认"（无）"
- [ ] 点击"选择图片"按钮 → 文件选择器打开，选择后路径回填
- [ ] 手动输入外部路径后保存 → 文件被复制到 templates/ 目录
- [ ] 创建 IMAGE_GROUP 步骤 → 类型标签显示"图像组匹配"，可编辑模板列表和 ALL/ANY 逻辑
- [ ] TaskEditor 中点击"+ 添加步骤组" → Modal 打开，创建后步骤组卡片出现
- [ ] 步骤组卡片显示循环次数标签，可编辑和删除
- [ ] 删除步骤组 → 组内步骤变为未分组
- [ ] "+ 在该组添加步骤"按钮 → 新步骤归属该组

- [ ] **Step 4: 提交（如有修复）**
