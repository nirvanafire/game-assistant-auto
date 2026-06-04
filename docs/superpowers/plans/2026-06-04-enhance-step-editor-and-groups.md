# 增强步骤编辑器与步骤组管理 实现计划

> **致自动化执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 来逐任务执行本计划。步骤使用 checkbox（`- [ ]`）语法跟踪。

**目标：** 统一编辑入口、模板图片持久化、开关横排布局、IMAGE_GROUP 编辑器、转场默认值语义、步骤组管理 UI。

**架构：** 改动集中在渲染层（StepEditor、TaskEditor、列表组件、App.tsx）、主进程服务（template-storage、task-engine、storage、IPC）、共享类型和数据库迁移。模板图片通过新的 `template-storage` 服务管理；步骤组 CRUD 通过新 IPC 通道暴露；引擎语义从"undefined=推进"改为"undefined=停止"并通过 migration v4 回填现有数据保持行为一致。

**技术栈：** Electron, TypeScript, React 19, Ant Design 6, better-sqlite3, Vitest

**排除范围（来自 proposal.md）：**
- 不改动 Python 匹配服务或匹配协议
- 不支持步骤在组间拖拽
- 不做孤儿模板图片清理工具
- 不在步骤组内并行执行步骤
- 不改动任务组编排、中断处理器、网络监控或日志

---

## 文件结构

### 新增文件
- `src/main/services/template-storage.ts` — 模板图片管理服务（目录初始化、路径归一化、文件复制）
- `src/main/services/__tests__/template-storage.test.ts` — 单元测试
- `src/main/ipc/image.ts` — 图片相关 IPC 处理器（image:pick, image:normalize）
- `src/main/ipc/step-group.ts` — 步骤组 IPC 处理器
- `src/main/ipc/__tests__/image-ipc.test.ts` — 图片 IPC 测试
- `src/main/ipc/__tests__/step-group-ipc.test.ts` — 步骤组 IPC 测试
- `src/main/services/__tests__/transition-semantics.test.ts` — 引擎转场语义测试
- `src/main/db/__tests__/migration-v4.test.ts` — 迁移测试
- `src/renderer/components/Assistant/StepGroupCard.tsx` — 步骤组卡片组件

### 修改文件
- `src/shared/types/task.ts` — StepTransition.action 新增 `'NEXT_STEP'`
- `src/shared/types/__tests__/task-types.test.ts` — 更新测试
- `src/shared/constants.ts` — 新增 IPC 通道常量
- `src/main/db/migrations.ts` — 新增 migration v4
- `src/main/db/schema.ts` — schema 版本更新到 4
- `src/main/services/task-engine.ts` — NEXT_STEP 分支 + undefined 停止语义
- `src/main/services/storage.ts` — 新增步骤组 CRUD 方法
- `src/main/index.ts` — 注册新 IPC 处理器、初始化 template-storage
- `src/renderer/App.tsx` — 移除 task-editor/group-editor 视图分支
- `src/renderer/components/Assistant/StepEditor.tsx` — 开关横排、IMAGE_GROUP 编辑器、图片选择按钮、NEXT_STEP 选项、新默认值
- `src/renderer/components/Assistant/TaskEditor.tsx` — 步骤组管理 UI
- `src/renderer/components/Assistant/TaskList.tsx` — 移除 onEdit prop
- `src/renderer/components/Assistant/TaskGroupList.tsx` — 移除 onEdit prop

---

## Task 1: 共享类型 — NEXT_STEP 转场动作

**文件：**
- 修改：`src/shared/types/task.ts`
- 测试：`src/shared/types/__tests__/task-types.test.ts`

- [ ] **Step 1: 写失败测试**

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

- [ ] **Step 3: 写最小实现**

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

- [ ] **Step 5: 重构**

检查是否有其他文件引用了 `StepTransition.action` 的类型定义需要更新。确认 TypeScript 编译无错误。

- [ ] **Step 6: 提交**

```bash
git add src/shared/types/task.ts src/shared/types/__tests__/task-types.test.ts
git commit -m "feat: add NEXT_STEP action to StepTransition"
```

---

## Task 2: IPC 通道常量 + 步骤组存储方法

**文件：**
- 修改：`src/shared/constants.ts`
- 修改：`src/main/services/storage.ts`

- [ ] **Step 1: 写失败测试**

在 `src/shared/__tests__/constants.test.ts`（已存在则更新）中添加：

```typescript
it('includes IMAGE_PICK channel', () => {
  expect(IPC_CHANNELS.IMAGE_PICK).toBe('image:pick');
});
it('includes IMAGE_NORMALIZE channel', () => {
  expect(IPC_CHANNELS.IMAGE_NORMALIZE).toBe('image:normalize');
});
it('includes STEP_GROUP_LIST channel', () => {
  expect(IPC_CHANNELS.STEP_GROUP_LIST).toBe('step-group:list');
});
it('includes STEP_GROUP_CREATE channel', () => {
  expect(IPC_CHANNELS.STEP_GROUP_CREATE).toBe('step-group:create');
});
it('includes STEP_GROUP_UPDATE channel', () => {
  expect(IPC_CHANNELS.STEP_GROUP_UPDATE).toBe('step-group:update');
});
it('includes STEP_GROUP_DELETE channel', () => {
  expect(IPC_CHANNELS.STEP_GROUP_DELETE).toBe('step-group:delete');
});
```

在 `src/main/services/__tests__/storage.test.ts`（已存在则更新）中添加：

```typescript
it('creates and lists step groups', () => {
  const task = storage.createTask({ name: 'Test' });
  const group = storage.createStepGroup({ taskId: task.id, name: 'Loop', loopCount: 3 });
  expect(group.name).toBe('Loop');
  expect(group.loopCount).toBe(3);
  const groups = storage.listStepGroupsByTask(task.id);
  expect(groups).toHaveLength(1);
  expect(groups[0].id).toBe(group.id);
});

it('updates step group', () => {
  const task = storage.createTask({ name: 'Test' });
  const group = storage.createStepGroup({ taskId: task.id, name: 'Old', loopCount: 1 });
  storage.updateStepGroup(group.id, { name: 'New', loopCount: 5 });
  const updated = storage.listStepGroupsByTask(task.id)[0];
  expect(updated.name).toBe('New');
  expect(updated.loopCount).toBe(5);
});

it('delete step group ungroups steps first', () => {
  const task = storage.createTask({ name: 'Test' });
  const group = storage.createStepGroup({ taskId: task.id, name: 'G', loopCount: 2 });
  const step = storage.createStep({
    taskId: task.id, type: 'IMAGE_MATCH', order: 1, groupId: group.id,
    config: { templatePath: '/a.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] },
    onMatch: { action: 'NEXT_STEP' }, onMiss: { action: 'END_TASK' },
    screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false,
  });
  storage.deleteStepGroup(group.id);
  const groups = storage.listStepGroupsByTask(task.id);
  expect(groups).toHaveLength(0);
  const steps = storage.listSteps(task.id);
  expect(steps[0].groupId).toBeUndefined();
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/shared/__tests__/constants.test.ts src/main/services/__tests__/storage.test.ts`
预期：FAIL — 新通道常量和存储方法不存在

- [ ] **Step 3: 写最小实现**

在 `src/shared/constants.ts` 的 `IPC_CHANNELS` 对象中添加：

```typescript
  IMAGE_PICK: 'image:pick',
  IMAGE_NORMALIZE: 'image:normalize',
  STEP_GROUP_LIST: 'step-group:list',
  STEP_GROUP_CREATE: 'step-group:create',
  STEP_GROUP_UPDATE: 'step-group:update',
  STEP_GROUP_DELETE: 'step-group:delete',
```

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
    this.db.prepare('UPDATE steps SET group_id = NULL WHERE group_id = ?').run(id);
    this.db.prepare('DELETE FROM step_groups WHERE id = ?').run(id);
  }
```

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/shared/__tests__/constants.test.ts src/main/services/__tests__/storage.test.ts`
预期：PASS

- [ ] **Step 5: 重构**

确认 `listStepGroupsByTask` 与已有的 `listStepGroups` 方法名不冲突。检查 `StepGroup` 类型的导入是否正确。

- [ ] **Step 6: 提交**

```bash
git add src/shared/constants.ts src/main/services/storage.ts src/shared/__tests__/constants.test.ts src/main/services/__tests__/storage.test.ts
git commit -m "feat: add IPC channel constants and step-group CRUD in StorageService"
```

---

## Task 3: 模板图片管理服务

**文件：**
- 创建：`src/main/services/template-storage.ts`
- 测试：`src/main/services/__tests__/template-storage.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// src/main/services/__tests__/template-storage.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

- [ ] **Step 3: 写最小实现**

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

- [ ] **Step 5: 重构**

确认 `path.resolve` 在 Windows 上的行为与测试一致。检查 `uuid` 依赖是否已安装。

- [ ] **Step 6: 提交**

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

- [ ] **Step 1: 写失败测试**

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

- [ ] **Step 3: 写最小实现**

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

在 `src/main/index.ts` 中注册：在 `app.whenReady()` 内、创建 `StorageService` 之后，创建 `TemplateStorage` 实例并调用 `init()`，然后调用 `createImageIpcHandlers(registry, templateStorage)` 和 `createStepGroupIpcHandlers(registry, storage)`。

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/main/ipc/__tests__/image-ipc.test.ts`
预期：PASS

- [ ] **Step 5: 重构**

确认 `IpcRegistry` 类型与 `src/main/ipc/registry.ts` 中的导出一致。检查 `main/index.ts` 中的导入顺序和初始化顺序。

- [ ] **Step 6: 提交**

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

- [ ] **Step 1: 写失败测试**

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
    runMigrations(db); // Run up to v3
  });

  it('backfills empty on_match for IMAGE_MATCH to NEXT_STEP', () => {
    db.prepare("INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)").run('t1', 'Test', 'idle', '{}', '[]');
    db.prepare('INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('s1', 't1', 'IMAGE_MATCH', 1, '{}', '{}', '{}', 0, 0, 0);
    runMigrations(db);
    const row = db.prepare('SELECT on_match FROM steps WHERE id = ?').get('s1') as any;
    expect(JSON.parse(row.on_match)).toEqual({ action: 'NEXT_STEP' });
  });

  it('backfills empty on_miss for IMAGE_GROUP to NEXT_STEP', () => {
    db.prepare("INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)").run('t1', 'Test', 'idle', '{}', '[]');
    db.prepare('INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('s1', 't1', 'IMAGE_GROUP', 1, '{}', '{}', '{}', 0, 0, 0);
    runMigrations(db);
    const row = db.prepare('SELECT on_miss FROM steps WHERE id = ?').get('s1') as any;
    expect(JSON.parse(row.on_miss)).toEqual({ action: 'NEXT_STEP' });
  });

  it('does not modify CLICK rows', () => {
    db.prepare("INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)").run('t1', 'Test', 'idle', '{}', '[]');
    db.prepare('INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('s1', 't1', 'CLICK', 1, '{}', '{}', '{}', 0, 0, 0);
    runMigrations(db);
    const row = db.prepare('SELECT on_match FROM steps WHERE id = ?').get('s1') as any;
    expect(row.on_match).toBe('{}');
  });

  it('does not modify rows with existing action', () => {
    db.prepare("INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)").run('t1', 'Test', 'idle', '{}', '[]');
    db.prepare('INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('s1', 't1', 'IMAGE_MATCH', 1, '{}', '{"action":"END_TASK"}', '{}', 0, 0, 0);
    runMigrations(db);
    const row = db.prepare('SELECT on_match FROM steps WHERE id = ?').get('s1') as any;
    expect(JSON.parse(row.on_match)).toEqual({ action: 'END_TASK' });
  });

  it('does not modify rows with nextStepId', () => {
    db.prepare("INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)").run('t1', 'Test', 'idle', '{}', '[]');
    db.prepare('INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('s1', 't1', 'IMAGE_MATCH', 1, '{}', '{"nextStepId":"s3"}', '{}', 0, 0, 0);
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
预期：FAIL — migration v4 不存在，schema version 仍为 3

- [ ] **Step 3: 写最小实现**

在 `src/main/db/migrations.ts` 的 migrations 数组末尾添加：

```typescript
  {
    version: 4,
    up: (db: Database.Database) => {
      db.exec(`
        UPDATE steps SET on_match = '{"action":"NEXT_STEP"}'
        WHERE type IN ('IMAGE_MATCH', 'IMAGE_GROUP')
          AND (on_match IS NULL OR on_match = '' OR on_match = '{}'
            OR (json_extract(on_match, '$.action') IS NULL AND json_extract(on_match, '$.nextStepId') IS NULL));
      `);
      db.exec(`
        UPDATE steps SET on_miss = '{"action":"NEXT_STEP"}'
        WHERE type IN ('IMAGE_MATCH', 'IMAGE_GROUP')
          AND (on_miss IS NULL OR on_miss = '' OR on_miss = '{}'
            OR (json_extract(on_miss, '$.action') IS NULL AND json_extract(on_miss, '$.nextStepId') IS NULL));
      `);
    },
  },
```

在 `src/main/db/schema.ts` 中将 `VALUES (3)` 改为 `VALUES (4)`。

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/main/db/__tests__/migration-v4.test.ts`
预期：PASS

- [ ] **Step 5: 重构**

确认 migration v4 的 SQL 在 NULL、空字符串、`'{}'`、部分 JSON 等边界条件下都能正确处理。检查 schema.ts 中的版本号是否只有一处需要更新。

- [ ] **Step 6: 提交**

```bash
git add src/main/db/migrations.ts src/main/db/schema.ts src/main/db/__tests__/migration-v4.test.ts
git commit -m "feat: add migration v4 to backfill NEXT_STEP transitions"
```

---

## Task 6: TaskEngine — NEXT_STEP + undefined 停止语义

**文件：**
- 修改：`src/main/services/task-engine.ts`
- 测试：`src/main/services/__tests__/transition-semantics.test.ts`

- [ ] **Step 1: 写失败测试**

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

- [ ] **Step 3: 写最小实现**

修改 `src/main/services/task-engine.ts` 中处理转场的逻辑。

在非组步骤的转场处理中，将：

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

- [ ] **Step 5: 重构**

运行全部 TaskEngine 测试确认无回归。检查组内步骤的转场处理是否也正确应用了 NEXT_STEP 和 undefined 语义。

运行：`npx vitest run src/main/services/__tests__/`
预期：ALL PASS

- [ ] **Step 6: 提交**

```bash
git add src/main/services/task-engine.ts src/main/services/__tests__/transition-semantics.test.ts
git commit -m "feat: implement NEXT_STEP and undefined-halt transition semantics"
```

---

## Task 7: StepEditor — 开关横排 + CLICK 隐藏 + 新默认值 + 转场选项

**文件：**
- 修改：`src/renderer/components/Assistant/StepEditor.tsx`

- [ ] **Step 1: 写失败测试**

在 `src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx` 中添加：

```typescript
it('shows horizontal toggle row for IMAGE_MATCH', () => {
  render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByText('全新截图')).toBeTruthy();
  expect(screen.getByText('实时比对')).toBeTruthy();
  expect(screen.getByText('缓存坐标')).toBeTruthy();
});

it('hides all toggles for CLICK type', () => {
  render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
  const typeSelect = screen.getByLabelText('类型');
  fireEvent.mouseDown(typeSelect);
  fireEvent.click(screen.getByText('点击'));
  expect(screen.queryByText('全新截图')).toBeNull();
  expect(screen.queryByText('实时比对')).toBeNull();
  expect(screen.queryByText('缓存坐标')).toBeNull();
});

it('defaults cacheCoordinates to true for new steps', () => {
  render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
  const switch_ = screen.getByText('缓存坐标').closest('.ant-form-item')?.querySelector('.ant-switch');
  expect(switch_?.classList.contains('ant-switch-checked')).toBe(true);
});

it('defaults onMatch to NEXT_STEP for new steps', () => {
  render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByText('下一个步骤')).toBeTruthy();
});

it('shows NEXT_STEP option in transition select', () => {
  render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
  const select = screen.getByText('匹配时').closest('.ant-card')?.querySelector('.ant-select');
  expect(select).toBeTruthy();
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx`
预期：FAIL — 横排布局不存在、CLICK 仍显示开关、默认值不正确

- [ ] **Step 3: 写最小实现**

1. 更新 `TRANSITION_ACTIONS` 添加 `NEXT_STEP`
2. 将三个开关用 `Space` 水平排列，`cacheCoordinates` 扩展到 IMAGE_GROUP
3. CLICK 类型隐藏全部三个开关和转场卡片
4. 新建步骤默认 `cacheCoordinates: true`、`onMatchAction: 'NEXT_STEP'`
5. 类型 Select 标签改为"图像组匹配"

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx`
预期：PASS

- [ ] **Step 5: 重构**

检查 `END_STEP_GROUP` 在步骤无 `groupId` 时是否正确隐藏/禁用。确认横排布局在窄屏下换行正常。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/components/Assistant/StepEditor.tsx src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx
git commit -m "feat: horizontal toggles, CLICK hide, NEXT_STEP defaults, image-group-match label"
```

---

## Task 8: StepEditor — IMAGE_GROUP 编辑器

**文件：**
- 修改：`src/renderer/components/Assistant/StepEditor.tsx`

- [ ] **Step 1: 写失败测试**

在 `src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx` 中添加：

```typescript
it('shows template list for IMAGE_GROUP type', () => {
  render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
  const typeSelect = screen.getByLabelText('类型');
  fireEvent.mouseDown(typeSelect);
  fireEvent.click(screen.getByText('图像组匹配'));
  expect(screen.getByText('+ 添加模板')).toBeTruthy();
});

it('shows ALL/ANY logic radio for IMAGE_GROUP', () => {
  render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
  const typeSelect = screen.getByLabelText('类型');
  fireEvent.mouseDown(typeSelect);
  fireEvent.click(screen.getByText('图像组匹配'));
  expect(screen.getByText('满足其一（任一匹配）')).toBeTruthy();
  expect(screen.getByText('同时满足（全部匹配）')).toBeTruthy();
});

it('defaults logic to ANY for IMAGE_GROUP', () => {
  render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
  const typeSelect = screen.getByLabelText('类型');
  fireEvent.mouseDown(typeSelect);
  fireEvent.click(screen.getByText('图像组匹配'));
  const anyRadio = screen.getByLabelText('满足其一（任一匹配）');
  expect(anyRadio.closest('.ant-radio-wrapper')?.classList.contains('ant-radio-wrapper-checked')).toBe(true);
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx`
预期：FAIL — IMAGE_GROUP 编辑器不存在

- [ ] **Step 3: 写最小实现**

新增 `ImageGroupFields` 内部组件：
- `Form.List` 模板列表，每项含 label / templatePath + 选择图片按钮 / threshold
- "+ 添加模板"按钮，最后一项不可删除
- `logic` Radio.Group（ALL/ANY），默认 ANY
- 共享 delayMs / retryCount / retryIntervalMs / scaleRange 字段
- 转场卡片与 IMAGE_MATCH 一致

更新 `buildConfig` IMAGE_GROUP 分支返回表单数据。

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx`
预期：PASS

- [ ] **Step 5: 重构**

检查保存前校验逻辑：至少一个模板、label/path 非空、threshold 在 [0,1]。确认 `buildConfig` 返回值与 `ImageGroupMatchConfig` 类型一致。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/components/Assistant/StepEditor.tsx src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx
git commit -m "feat: add IMAGE_GROUP editor with multi-template list and ALL/ANY logic"
```

---

## Task 9: StepEditor — 图片选择与保存时归一化

**文件：**
- 修改：`src/renderer/components/Assistant/StepEditor.tsx`

- [ ] **Step 1: 写失败测试**

在 `src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx` 中添加：

```typescript
it('shows image picker button next to templatePath input', () => {
  render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByText('选择图片')).toBeTruthy();
});

it('invokes image:pick and image:normalize on picker click', async () => {
  const mockInvoke = vi.fn()
    .mockResolvedValueOnce({ sourcePath: '/ext/img.png' })
    .mockResolvedValueOnce({ savedPath: '/templates/abc.png' });
  (window as any).electronAPI = { invoke: mockInvoke, on: vi.fn(), removeAllListeners: vi.fn() };
  render(<StepEditor taskId="t1" onSave={vi.fn()} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByText('选择图片'));
  await waitFor(() => {
    expect(mockInvoke).toHaveBeenCalledWith('image:pick');
    expect(mockInvoke).toHaveBeenCalledWith('image:normalize', { sourcePath: '/ext/img.png' });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx`
预期：FAIL — 选择图片按钮不存在

- [ ] **Step 3: 写最小实现**

在 `ImageMatchFields` 和 `ImageGroupFields` 中，每个 `templatePath` 输入框旁添加"选择图片"按钮。

修改 `handleSubmit` 为 async 函数，在调用 `onSave` 之前对所有 `templatePath` 调用 `image:normalize`，失败则中止保存。

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx`
预期：PASS

- [ ] **Step 5: 重构**

检查 `handleSubmit` 的错误处理：归一化失败时在对应字段设置表单错误。确认 IMAGE_GROUP 的多个模板路径都正确归一化。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/components/Assistant/StepEditor.tsx src/renderer/components/Assistant/__tests__/StepEditor-updates.test.tsx
git commit -m "feat: add image picker and normalize-on-save to StepEditor"
```

---

## Task 10: TaskEditor — 步骤组管理

**文件：**
- 创建：`src/renderer/components/Assistant/StepGroupCard.tsx`
- 修改：`src/renderer/components/Assistant/TaskEditor.tsx`

- [ ] **Step 1: 写失败测试**

在 `src/renderer/components/Assistant/__tests__/TaskEditor-groups.test.tsx` 中添加：

```typescript
it('shows add step group button', () => {
  render(<TaskEditor taskId="t1" onClose={vi.fn()} />);
  expect(screen.getByText('+ 添加步骤组')).toBeTruthy();
});

it('shows step groups loaded from IPC', async () => {
  const mockInvoke = vi.fn().mockImplementation((channel: string) => {
    if (channel === 'task:get') return Promise.resolve({ task: { id: 't1', name: 'Test' } });
    if (channel === 'task:get-steps') return Promise.resolve({ steps: [] });
    if (channel === 'step-group:list') return Promise.resolve({ groups: [{ id: 'g1', taskId: 't1', name: 'Loop', loopCount: 3 }] });
    return Promise.resolve({});
  });
  (window as any).electronAPI = { invoke: mockInvoke, on: vi.fn(), removeAllListeners: vi.fn() };
  render(<TaskEditor taskId="t1" onClose={vi.fn()} />);
  await waitFor(() => {
    expect(screen.getByText('Loop')).toBeTruthy();
    expect(screen.getByText('循环 ×3')).toBeTruthy();
  });
});

it('shows ungrouped steps section', async () => {
  const mockInvoke = vi.fn().mockImplementation((channel: string) => {
    if (channel === 'task:get') return Promise.resolve({ task: { id: 't1', name: 'Test' } });
    if (channel === 'task:get-steps') return Promise.resolve({ steps: [{ id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: {}, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false }] });
    if (channel === 'step-group:list') return Promise.resolve({ groups: [] });
    return Promise.resolve({});
  });
  (window as any).electronAPI = { invoke: mockInvoke, on: vi.fn(), removeAllListeners: vi.fn() };
  render(<TaskEditor taskId="t1" onClose={vi.fn()} />);
  await waitFor(() => {
    expect(screen.getByText('（未分组）')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/renderer/components/Assistant/__tests__/TaskEditor-groups.test.tsx`
预期：FAIL — 步骤组管理 UI 不存在

- [ ] **Step 3: 写最小实现**

1. 创建 `StepGroupCard` 组件
2. TaskEditor 加载步骤组列表
3. "+ 添加步骤组"按钮 + 创建/编辑 Modal（name + loopCount）
4. 步骤按 groupId 分组展示，未分组步骤单独分区
5. 组按成员步骤最小 order 排序，空组排在末尾
6. 删除组确认后解组步骤
7. 增删改后重新加载

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/renderer/components/Assistant/__tests__/TaskEditor-groups.test.tsx`
预期：PASS

- [ ] **Step 5: 重构**

检查 `StepGroupCard` 的 props 接口是否与 TaskEditor 的调用一致。确认步骤组卡片的循环次数标签显示正确（0 = ∞）。确认"+ 在该组添加步骤"按钮正确传入 groupId。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/components/Assistant/StepGroupCard.tsx src/renderer/components/Assistant/TaskEditor.tsx src/renderer/components/Assistant/__tests__/TaskEditor-groups.test.tsx
git commit -m "feat: add step group management UI to TaskEditor"
```

---

## Task 11: App.tsx + 列表组件 — 移除全屏编辑器视图

**文件：**
- 修改：`src/renderer/App.tsx`
- 修改：`src/renderer/components/Assistant/TaskList.tsx`
- 修改：`src/renderer/components/Assistant/TaskGroupList.tsx`

- [ ] **Step 1: 写失败测试**

在 `src/renderer/__tests__/App.test.tsx` 中添加：

```typescript
it('does not render task-editor view', () => {
  render(<App />);
  expect(screen.queryByText('编辑任务')).toBeNull();
});

it('only shows tasks and groups toggle buttons', () => {
  render(<App />);
  expect(screen.getByText('任务')).toBeTruthy();
  expect(screen.getByText('任务组')).toBeTruthy();
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx vitest run src/renderer/__tests__/App.test.tsx`
预期：FAIL — task-editor 视图分支仍存在

- [ ] **Step 3: 写最小实现**

1. `App.tsx`：从 `AssistantView` 类型中删除 `'task-editor'` 和 `'group-editor'`。移除 `renderAssistantContent()` 中对应的 case 分支。移除 `editingTaskId` 和 `editingGroupId` 状态。顶部栏仅保留 `'tasks'` 和 `'groups'` 两个按钮。

2. `TaskList.tsx`：从 `TaskListProps` 中移除 `onEdit`。编辑按钮的 onClick 直接调用 `setDrawerTaskId(taskId)`。移除对 `onEdit` 的调用。

3. `TaskGroupList.tsx`：从 `TaskGroupListProps` 中移除 `onEdit`。编辑按钮和双击统一调用 `setDrawerGroupId(groupId)`。

- [ ] **Step 4: 运行测试确认通过**

运行：`npx vitest run src/renderer/__tests__/App.test.tsx`
预期：PASS

- [ ] **Step 5: 重构**

运行构建验证无 TypeScript 错误。检查 `TaskList` 和 `TaskGroupList` 的 `onEdit` prop 移除后，父组件（App.tsx）中传递该 prop 的地方也已清理。

运行：`npm run build`
预期：BUILD SUCCESS

- [ ] **Step 6: 提交**

```bash
git add src/renderer/App.tsx src/renderer/components/Assistant/TaskList.tsx src/renderer/components/Assistant/TaskGroupList.tsx src/renderer/__tests__/App.test.tsx
git commit -m "feat: remove full-panel editor views, unify edit entry via Drawer"
```

---

## Task 12: 最终集成验证

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
