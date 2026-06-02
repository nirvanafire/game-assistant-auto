# Task Engine Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the task engine with clicker service, step group loops, interrupt handlers, run history logging, and execution status UI.

**Architecture:** ClickerService wraps webContents.sendInputEvent for mouse simulation. TaskEngine gains step group loop execution, interrupt handler pre-scan, and run history persistence. TaskGroupEngine gains run history. Execution status streams to renderer via IPC.

**Tech Stack:** TypeScript, Electron (webContents, sendInputEvent), better-sqlite3, React, Zustand, Ant Design

---

## Task 1: Clicker Service

**Files:**
- Create: `src/main/services/clicker.ts`
- Create: `src/main/services/__tests__/clicker.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClickerService } from '../clicker';

describe('ClickerService', () => {
  let clicker: ClickerService;
  let mockWebContents: any;

  beforeEach(() => {
    mockWebContents = {
      sendInputEvent: vi.fn(),
    };
    clicker = new ClickerService(mockWebContents);
  });

  it('sends mouseDown and mouseUp for a single click', async () => {
    await clicker.click(100, 200);
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledWith({
      type: 'mouseDown', x: 100, y: 200, button: 'left', clickCount: 1,
    });
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledWith({
      type: 'mouseUp', x: 100, y: 200, button: 'left', clickCount: 1,
    });
  });

  it('supports right click', async () => {
    await clicker.click(50, 50, { button: 'right' });
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ button: 'right' }),
    );
  });

  it('supports multiple clicks with interval', async () => {
    await clicker.click(10, 20, { count: 2, intervalMs: 50 });
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledTimes(4); // 2 * (down + up)
  });

  it('supports fixed coordinate click via clickAt', async () => {
    await clicker.clickAt({ x: 300, y: 400 });
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ x: 300, y: 400 }),
    );
  });
});
```

- [ ] **Step 2: Implement clicker.ts**

```typescript
import type { WebContents } from 'electron';

export interface ClickOptions {
  button?: 'left' | 'right';
  count?: number;
  intervalMs?: number;
}

export class ClickerService {
  private webContents: WebContents;

  constructor(webContents: WebContents) {
    this.webContents = webContents;
  }

  async click(x: number, y: number, options?: ClickOptions): Promise<void> {
    const button = options?.button ?? 'left';
    const count = options?.count ?? 1;
    const intervalMs = options?.intervalMs ?? 0;

    for (let i = 0; i < count; i++) {
      if (i > 0 && intervalMs > 0) {
        await this.delay(intervalMs);
      }
      this.webContents.sendInputEvent({
        type: 'mouseDown', x, y, button, clickCount: 1,
      });
      this.webContents.sendInputEvent({
        type: 'mouseUp', x, y, button, clickCount: 1,
      });
    }
  }

  async clickAt(coords: { x: number; y: number }, options?: ClickOptions): Promise<void> {
    await this.click(coords.x, coords.y, options);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 3: Run tests and commit**

---

## Task 2: Task Engine — Step Group Loop Execution

**Files:**
- Modify: `src/main/services/task-engine.ts`
- Modify: `src/main/services/__tests__/task-engine.test.ts`

- [ ] **Step 1: Add step group test**

Add to the existing test file:

```typescript
it('executes step group with loop count', async () => {
  mockStorage.listSteps.mockReturnValue([
    { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
    { id: 's2', taskId: 't1', type: 'IMAGE_MATCH', order: 2, groupId: 'sg1', config: { templatePath: '/img2.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
    { id: 's3', taskId: 't1', type: 'IMAGE_MATCH', order: 3, groupId: null, config: { templatePath: '/img3.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
  ]);
  mockStorage.listStepGroups.mockReturnValue([
    { id: 'sg1', taskId: 't1', name: 'Loop Group', loopCount: 2 },
  ]);
  await engine.start('t1');
  // s1 and s2 should execute 2 times each, then s3 once
  expect(mockMatcher.match).toHaveBeenCalledTimes(5);
});
```

- [ ] **Step 2: Add StorageService.listStepGroups**

Add to `src/main/services/storage.ts`:

```typescript
listStepGroups(taskId: string): StepGroup[] {
  const rows = this.db.prepare('SELECT * FROM step_groups WHERE task_id = ?').all(taskId) as any[];
  return rows.map(row => ({
    id: row.id,
    taskId: row.task_id,
    name: row.name,
    loopCount: row.loop_count,
  }));
}
```

Import `StepGroup` from `@shared/types/task`.

- [ ] **Step 3: Implement step group loop in TaskEngine**

Modify `executeSteps` in `task-engine.ts` to handle step groups:

```typescript
private async executeSteps(
  taskId: string,
  steps: Step[],
  settings: TaskSettings,
  ctx: StepContext,
  signal: AbortSignal,
): Promise<void> {
  const stepGroups = this.storage.listStepGroups(taskId);
  const stepsById = new Map(steps.map(s => [s.id, s]));
  let stepIndex = 0;
  const startTime = Date.now();

  while (stepIndex < steps.length) {
    if (signal.aborted) throw new Error('STOPPED');
    if (Date.now() - startTime > settings.globalTimeoutMs) {
      this.statuses.set(taskId, 'failed');
      return;
    }

    const currentStep = steps[stepIndex];
    ctx.currentStepId = currentStep.id;

    // Find step group for this step
    const group = currentStep.groupId
      ? stepGroups.find(g => g.id === currentStep.groupId)
      : null;

    if (group) {
      // Collect all steps in this group
      const groupSteps = steps.filter(s => s.groupId === group.id);
      const loopCount = group.loopCount === 0 ? Infinity : group.loopCount;

      for (let loop = 0; loop < loopCount; loop++) {
        if (signal.aborted) throw new Error('STOPPED');

        for (const groupStep of groupSteps) {
          if (signal.aborted) throw new Error('STOPPED');
          if (Date.now() - startTime > settings.globalTimeoutMs) {
            this.statuses.set(taskId, 'failed');
            return;
          }

          ctx.currentStepId = groupStep.id;

          if (groupStep.screenshotBeforeMatch || !ctx.lastScreenshot) {
            ctx.lastScreenshot = await this.capture.capture();
          }

          const result = await this.executeStepWithTimeout(groupStep, ctx, settings.stepTimeoutMs, signal);
          const transition = result ? groupStep.onMatch : groupStep.onMiss;

          if (transition.action === 'END_TASK') {
            this.statuses.set(taskId, 'completed');
            return;
          }
          if (transition.action === 'END_GROUP_LOOP') {
            break;
          }
        }
      }

      // Skip past group steps in the main sequence
      const lastGroupStepIndex = steps.findIndex((s, i) => i >= stepIndex && s.groupId === group.id);
      const nextNonGroupIndex = steps.findIndex((s, i) => i > lastGroupStepIndex && s.groupId !== group.id);
      stepIndex = nextNonGroupIndex === -1 ? steps.length : nextNonGroupIndex;
    } else {
      // Normal step execution
      if (currentStep.screenshotBeforeMatch || !ctx.lastScreenshot) {
        ctx.lastScreenshot = await this.capture.capture();
      }

      const result = await this.executeStepWithTimeout(currentStep, ctx, settings.stepTimeoutMs, signal);
      const transition = result ? currentStep.onMatch : currentStep.onMiss;

      if (transition.action === 'END_TASK') {
        this.statuses.set(taskId, 'completed');
        return;
      }

      if (transition.nextStepId) {
        stepIndex = steps.findIndex(s => s.id === transition.nextStepId);
      } else {
        stepIndex++;
      }
    }
  }

  this.statuses.set(taskId, 'completed');
}
```

- [ ] **Step 4: Run tests and commit**

---

## Task 3: Task Engine — Interrupt Handlers

**Files:**
- Modify: `src/main/services/task-engine.ts`
- Modify: `src/main/services/__tests__/task-engine.test.ts`

- [ ] **Step 1: Add interrupt handler test**

```typescript
it('checks interrupt handlers before each step', async () => {
  mockStorage.getTask.mockReturnValue({
    id: 't1', name: 'Test', status: 'idle',
    settings: { screenshotBeforeMatch: false, maxRetries: 3, globalTimeoutMs: 60000, stepTimeoutMs: 10000 },
    interruptHandlers: [{
      id: 'ih1', label: 'Close Popup', templatePath: '/popup.png',
      threshold: 0.9, action: 'CLICK_AT_MATCH', priority: 1,
    }],
  });
  // First call: interrupt matches, second call: step matches
  mockMatcher.match
    .mockResolvedValueOnce({ matched: true, x: 50, y: 50, confidence: 0.95, scale: 1.0 })
    .mockResolvedValueOnce({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 });

  await engine.start('t1');
  // interrupt match + step match = 2 calls
  expect(mockMatcher.match).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Implement interrupt checking**

Add to `TaskEngine` class:

```typescript
private async checkInterrupts(
  task: Task,
  ctx: StepContext,
  signal: AbortSignal,
): Promise<void> {
  if (!task.interruptHandlers || task.interruptHandlers.length === 0) return;
  if (!ctx.lastScreenshot) return;

  for (const handler of task.interruptHandlers.sort((a, b) => a.priority - b.priority)) {
    if (signal.aborted) throw new Error('STOPPED');

    const result = await this.matcher.match({
      screenshot: ctx.lastScreenshot,
      template: handler.templatePath,
      threshold: handler.threshold,
      scaleRange: [0.5, 2.0],
    });

    if (result.matched) {
      if (handler.action === 'CLICK_AT_MATCH' && result.x != null && result.y != null) {
        await this.clicker.click(result.x, result.y);
        // Re-screenshot after clicking
        ctx.lastScreenshot = await this.capture.capture();
      } else if (handler.action === 'CLICK_FIXED' && handler.fixedCoords) {
        await this.clicker.click(handler.fixedCoords.x, handler.fixedCoords.y);
        ctx.lastScreenshot = await this.capture.capture();
      }
    }
  }
}
```

Update `executeSteps` to accept `task` and call `checkInterrupts` before each step. Also add `clicker` to the constructor.

- [ ] **Step 3: Run tests and commit**

---

## Task 4: Task Run History Logging

**Files:**
- Modify: `src/main/services/task-engine.ts`
- Modify: `src/main/services/__tests__/task-engine.test.ts`

- [ ] **Step 1: Add run history test**

```typescript
it('persists task run history to database', async () => {
  await engine.start('t1');
  expect(mockStorage.createTaskRun).toHaveBeenCalledWith(
    expect.objectContaining({ taskId: 't1', result: 'completed' }),
  );
});
```

- [ ] **Step 2: Add StorageService task run methods**

Add to `src/main/services/storage.ts`:

```typescript
createTaskRun(data: { taskId: string; result: string }): string {
  const id = uuidv4();
  const now = new Date().toISOString();
  this.db.prepare(
    'INSERT INTO task_runs (id, task_id, started_at, ended_at, result, log) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, data.taskId, now, now, data.result, '[]');
  return id;
}

updateTaskRun(id: string, data: { endedAt?: string; result?: string; log?: any[] }): void {
  if (data.endedAt) {
    this.db.prepare('UPDATE task_runs SET ended_at = ? WHERE id = ?').run(data.endedAt, id);
  }
  if (data.result) {
    this.db.prepare('UPDATE task_runs SET result = ? WHERE id = ?').run(data.result, id);
  }
  if (data.log) {
    this.db.prepare('UPDATE task_runs SET log = ? WHERE id = ?').run(JSON.stringify(data.log), id);
  }
}
```

- [ ] **Step 3: Integrate run logging into TaskEngine**

At the start of `start()`, create a task run. In the completion/failure/stopped handlers, update it with result and log entries.

- [ ] **Step 4: Run tests and commit**

---

## Task 5: Task Group Run History Logging

**Files:**
- Modify: `src/main/services/task-group-engine.ts`
- Modify: `src/main/services/__tests__/task-group-engine.test.ts`

- [ ] **Step 1: Add group run history test**

```typescript
it('persists task group run history', async () => {
  await engine.start('g1');
  expect(mockStorage.createTaskGroupRun).toHaveBeenCalledWith(
    expect.objectContaining({ taskGroupId: 'g1', result: 'completed' }),
  );
});
```

- [ ] **Step 2: Add StorageService task group run methods**

Add to `src/main/services/storage.ts`:

```typescript
createTaskGroupRun(data: { taskGroupId: string; result: string }): string {
  const id = uuidv4();
  const now = new Date().toISOString();
  this.db.prepare(
    'INSERT INTO task_group_runs (id, task_group_id, started_at, ended_at, result, log) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, data.taskGroupId, now, now, data.result, '[]');
  return id;
}

updateTaskGroupRun(id: string, data: { endedAt?: string; result?: string; log?: any[] }): void {
  if (data.endedAt) {
    this.db.prepare('UPDATE task_group_runs SET ended_at = ? WHERE id = ?').run(data.endedAt, id);
  }
  if (data.result) {
    this.db.prepare('UPDATE task_group_runs SET result = ? WHERE id = ?').run(data.result, id);
  }
  if (data.log) {
    this.db.prepare('UPDATE task_group_runs SET log = ? WHERE id = ?').run(JSON.stringify(data.log), id);
  }
}
```

- [ ] **Step 3: Integrate into TaskGroupEngine**

At start of `start()`, create a group run. On completion, update with result.

- [ ] **Step 4: Run tests and commit**

---

## Task 6: Execution Status Display

**Files:**
- Create: `src/renderer/components/Assistant/ExecutionStatus.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Implement ExecutionStatus.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import { Card, Tag, List, Space, Typography } from 'antd';
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

    api.on(IPC_CHANNELS.TASK_STATUS_CHANGED, (data: any) => {
      setTaskStatus(data);
      if (data.status === 'idle' || data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
        setStepResults([]);
      }
    });

    api.on(IPC_CHANNELS.TASK_STEP_RESULT, (data: StepResult) => {
      setStepResults(prev => [data, ...prev].slice(0, 50));
    });

    return () => {
      api.removeAllListeners(IPC_CHANNELS.TASK_STATUS_CHANGED);
      api.removeAllListeners(IPC_CHANNELS.TASK_STEP_RESULT);
    };
  }, []);

  if (!taskStatus || taskStatus.status === 'idle') return null;

  const statusColor: Record<string, string> = {
    running: 'processing', completed: 'success', failed: 'error', stopped: 'default',
  };

  return (
    <Card size="small" title="Execution Status">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Text>Task:</Text>
          <Tag color={statusColor[taskStatus.status]}>{taskStatus.status}</Tag>
          {taskStatus.currentStepId && <Text type="secondary">Step: {taskStatus.currentStepId}</Text>}
        </Space>
        {stepResults.length > 0 && (
          <List
            size="small"
            dataSource={stepResults}
            renderItem={(r) => (
              <List.Item>
                <Tag color={r.matched ? 'green' : 'red'}>{r.matched ? 'MATCH' : 'MISS'}</Tag>
                <Text type="secondary">{r.stepId}</Text>
                <Text type="secondary" style={{ marginLeft: 'auto' }}>{r.timestamp}</Text>
              </List.Item>
            )}
          />
        )}
      </Space>
    </Card>
  );
};
```

- [ ] **Step 2: Wire into App.tsx**

Add `ExecutionStatus` below the Tasks/Groups toggle in the Assistant tab:

```tsx
import { ExecutionStatus } from './components/Assistant/ExecutionStatus';

// In renderAssistantContent, after the toggle buttons:
<ExecutionStatus />
```

- [ ] **Step 3: Commit**

---

## Task 7: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
