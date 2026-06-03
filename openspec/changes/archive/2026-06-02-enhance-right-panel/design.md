# Design: Enhance Right Panel

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Renderer (React)                                        │
│  ┌────────────────────┐  ┌─────────────────────────────┐ │
│  │ BrowserPanel        │  │ Right Panel (Tabs)          │ │
│  │ (unchanged)         │  │ ┌─ 辅助 ──────────────────┐ │ │
│  │                     │  │ │ TaskList (中文)          │ │ │
│  │                     │  │ │ TaskGroupList (中文)     │ │ │
│  │                     │  │ │ TaskGroupEditor (重构)   │ │ │
│  │                     │  │ │  - 拖拽排序              │ │ │
│  │                     │  │ │  - 条件跳转配置          │ │ │
│  │                     │  │ │  - 循环设置              │ │ │
│  │                     │  │ ├─ 工具 ──────────────────┤ │ │
│  │                     │  │ │ 日志 │ 图像对比 │ 点击   │ │ │
│  │                     │  │ ├─ 网络 ──────────────────┤ │ │
│  │                     │  │ │ NetworkLog              │ │ │
│  │                     │  │ └─────────────────────────┘ │ │
│  └────────────────────┘  └─────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│  IPC Bridge (preload)                                    │
├──────────────────────────────────────────────────────────┤
│  Main Process                                            │
│  ┌─────────────────────┐  ┌────────────────────────────┐ │
│  │ TaskGroupEngine      │  │ StorageService             │ │
│  │ (rewritten)          │  │ (extended)                 │ │
│  │  - conditional branch│  │  - loop fields CRUD        │ │
│  │  - loop control      │  │  - jump target CRUD        │ │
│  └─────────────────────┘  └────────────────────────────┘ │
│  ┌─────────────────────┐                                 │
│  │ SQLite (migrated)    │                                 │
│  │  - task_groups +loop │                                 │
│  │  - task_group_items  │                                 │
│  │    +on_success/fail  │                                 │
│  └─────────────────────┘                                 │
└──────────────────────────────────────────────────────────┘
```

## Data Model Changes

### task_groups table (add columns)

```sql
ALTER TABLE task_groups ADD COLUMN loop_enabled INTEGER DEFAULT 0;
ALTER TABLE task_groups ADD COLUMN loop_interval_ms INTEGER DEFAULT 0;
ALTER TABLE task_groups ADD COLUMN loop_max_iterations INTEGER DEFAULT 0;
```

- `loop_enabled`: 0 = disabled, 1 = enabled
- `loop_interval_ms`: milliseconds to wait between loop iterations
- `loop_max_iterations`: 0 means infinite (until manually stopped)

### task_group_items table (add columns)

```sql
ALTER TABLE task_group_items ADD COLUMN on_success TEXT DEFAULT NULL;
ALTER TABLE task_group_items ADD COLUMN on_failure TEXT DEFAULT NULL;
```

- `on_success`: target item ID, `'END'` to end group, `NULL` for next-in-order
- `on_failure`: target item ID, `'END'` to end group, `NULL` to end group

### TypeScript types

```typescript
// task-group.ts
export interface TaskGroup {
  id: string;
  name: string;
  failurePolicy: FailurePolicy;  // kept for backward compat
  retryCount: number;
  loopEnabled: boolean;
  loopIntervalMs: number;
  loopMaxIterations: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskGroupItem {
  id: string;
  taskGroupId: string;
  taskId: string;
  order: number;
  onSuccess: string | null;  // item ID, 'END', or null
  onFailure: string | null;  // item ID, 'END', or null
}
```

## Execution Engine Design

### TaskGroupEngine (rewritten)

```
start(taskGroupId):
  group = storage.getTaskGroup(taskGroupId)
  items = storage.listTaskGroupItems(taskGroupId)
  itemMap = buildItemMap(items)  // id -> item

  iteration = 0
  while shouldContinue(group, iteration):
    runGroupOnce(items, itemMap, group)
    iteration++
    if group.loopEnabled and shouldContinue(group, iteration):
      await delay(group.loopIntervalMs)
      checkStopped(taskGroupId)  // interruptible wait

runGroupOnce(items, itemMap, group):
  currentItem = items[0]  // start from first item
  while currentItem:
    success = await executeTask(currentItem.taskId)
    jumpTarget = success ? currentItem.onSuccess : currentItem.onFailure

    if jumpTarget == 'END':
      break
    elif jumpTarget == null:
      if success:
        currentItem = getNextInOrder(items, currentItem)
      else:
        break  // default: end on failure
    else:
      currentItem = itemMap[jumpTarget]

shouldContinue(group, iteration):
  if not group.loopEnabled: return iteration == 0
  if stopped: return false
  if group.loopMaxIterations == 0: return true  // infinite
  return iteration < group.loopMaxIterations
```

### Interruptible delay

```typescript
private async delay(ms: number, groupId: string): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Check periodically so stop() can interrupt
    const check = setInterval(() => {
      if (!this.running.get(groupId)) {
        clearTimeout(timer);
        clearInterval(check);
        resolve();
      }
    }, 200);
  });
}
```

## UI Design

### TaskGroupEditor (redesigned)

```
┌──────────────────────────────────────┐
│ 编辑任务组: 每日签到          [关闭]  │
├──────────────────────────────────────┤
│ 任务组名称: [每日签到          ]      │
│ [保存基本信息]                        │
│                                      │
│ ┌─ 循环设置 ─────────────────────┐   │
│ │ ☑ 启用循环                      │   │
│ │ 间隔(分钟): [30       ]        │   │
│ │ 最大次数:   [10       ]        │   │
│ │ (0 = 不限次数)                  │   │
│ │ [保存循环设置]                  │   │
│ └────────────────────────────────┘   │
│                                      │
│ ┌─ 任务编排 ─────────────────────┐   │
│ │ ☰ 1. 登录游戏        [删除]    │   │
│ │   成功 → [▼ 2.领取奖励]       │   │
│ │   失败 → [▼ 3.重新登录]       │   │
│ │                                 │   │
│ │ ☰ 2. 领取奖励        [删除]    │   │
│ │   成功 → [▼ 结束]             │   │
│ │   失败 → [▼ 结束]             │   │
│ │                                 │   │
│ │ ☰ 3. 重新登录        [删除]    │   │
│ │   成功 → [▼ 2.领取奖励]       │   │
│ │   失败 → [▼ 结束]             │   │
│ │                                 │   │
│ │ [+ 添加任务]                    │   │
│ └────────────────────────────────┘   │
└──────────────────────────────────────┘
```

### Jump Target Select options

For each item, the Select dropdown contains:
- "结束" (value: 'END')
- All other items by name (value: item.id), excluding self

### Drag-and-Drop

Using @dnd-kit/sortable:
- Each task item is a `SortableItem`
- Drag handle on the left (☰ icon)
- On drag end, update `order` field for all affected items via IPC
- Optimistic UI update, then sync with backend

## File Change Map

### Modified files

| File | Changes |
|------|---------|
| `src/shared/types/task-group.ts` | Add loop fields to TaskGroup, add on_success/on_failure to TaskGroupItem |
| `src/shared/constants.ts` | Add IPC channels for loop config and jump target updates |
| `src/main/db/schema.ts` | Add migration for new columns |
| `src/main/services/task-group-engine.ts` | Rewrite with conditional branching and loop support |
| `src/main/services/storage.ts` | Add methods for updating loop config and jump targets |
| `src/main/ipc/task-group.ts` | Add handlers for new operations |
| `src/renderer/App.tsx` | Chinese labels for tabs and buttons |
| `src/renderer/components/Assistant/TaskList.tsx` | Chinese strings |
| `src/renderer/components/Assistant/TaskGroupList.tsx` | Chinese strings |
| `src/renderer/components/Assistant/TaskGroupEditor.tsx` | Major rewrite: drag-and-drop, condition config, loop settings |
| `src/renderer/components/Assistant/TaskEditor.tsx` | Chinese strings |
| `src/renderer/components/Assistant/StepEditor.tsx` | Chinese strings |
| `src/renderer/components/Assistant/ExecutionStatus.tsx` | Chinese strings |
| `src/renderer/components/Tools/LogViewer.tsx` | Chinese strings |
| `src/renderer/components/Tools/ImageCompare.tsx` | Chinese strings |
| `src/renderer/components/Tools/ClickTest.tsx` | Chinese strings |
| `src/renderer/components/Network/NetworkLog.tsx` | Chinese strings |

### New dependencies

- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`
