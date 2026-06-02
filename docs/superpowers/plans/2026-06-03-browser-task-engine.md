# Browser & Task Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the task execution engine, screenshot capture, and task group engine — the core automation loop.

**Architecture:** TaskEngine is a state machine that executes steps sequentially. Each step type (IMAGE_MATCH, IMAGE_GROUP, CLICK) has a dedicated handler. ScreenshotCapture wraps webContents.capturePage. TaskGroupEngine serializes multiple task executions with failure policies.

**Tech Stack:** TypeScript, Electron (webContents), better-sqlite3

---

## File Structure

```
src/main/services/
├── capture.ts                 # Screenshot capture
├── capture.test.ts
├── task-engine.ts             # Task execution state machine
├── task-engine.test.ts
├── task-group-engine.ts       # Task group execution
└── task-group-engine.test.ts
```

---

## Task 1: Screenshot Capture Service

**Files:**
- Create: `src/main/services/capture.ts`
- Create: `src/main/services/__tests__/capture.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { CaptureService } from '../capture';

describe('CaptureService', () => {
  it('captures screenshot as base64', async () => {
    const mockWebContents = {
      capturePage: vi.fn().mockResolvedValue({
        toPNG: () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      }),
    };
    const service = new CaptureService(mockWebContents as any);
    const result = await service.capture();
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it('captures region only', async () => {
    const mockWebContents = {
      capturePage: vi.fn().mockResolvedValue({
        toPNG: () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        crop: vi.fn().mockReturnValue({
          toPNG: () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        }),
      }),
    };
    const service = new CaptureService(mockWebContents as any);
    const result = await service.captureRegion({ x: 10, y: 20, width: 100, height: 50 });
    expect(result).toMatch(/^data:image\/png;base64,/);
  });
});
```

- [ ] **Step 2: Implement capture.ts**

```typescript
import type { WebContents } from 'electron';

export class CaptureService {
  private webContents: WebContents;

  constructor(webContents: WebContents) {
    this.webContents = webContents;
  }

  async capture(): Promise<string> {
    const image = await this.webContents.capturePage();
    const buffer = image.toPNG();
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }

  async captureRegion(region: { x: number; y: number; width: number; height: number }): Promise<string> {
    const image = await this.webContents.capturePage(region);
    const buffer = image.toPNG();
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx vitest run src/main/services/__tests__/capture.test.ts
git add src/main/services/capture.ts src/main/services/__tests__/capture.test.ts
git commit -m "feat: add CaptureService for webContents screenshot capture"
```

---

## Task 2: Task Engine Core

**Files:**
- Create: `src/main/services/task-engine.ts`
- Create: `src/main/services/__tests__/task-engine.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEngine } from '../task-engine';

describe('TaskEngine', () => {
  let engine: TaskEngine;
  let mockStorage: any;
  let mockCapture: any;
  let mockMatcher: any;
  let mockClicker: any;

  beforeEach(() => {
    mockStorage = {
      getTask: vi.fn().mockReturnValue({ id: 't1', name: 'Test', status: 'idle', settings: { screenshotBeforeMatch: false, maxRetries: 3, globalTimeoutMs: 60000, stepTimeoutMs: 10000 }, interruptHandlers: [] }),
      listSteps: vi.fn().mockReturnValue([
        { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
      ]),
      updateTask: vi.fn(),
    };
    mockCapture = { capture: vi.fn().mockResolvedValue('data:image/png;base64,abc'), captureRegion: vi.fn() };
    mockMatcher = { match: vi.fn().mockResolvedValue({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 }), matchGroup: vi.fn(), health: vi.fn() };
    mockClicker = { click: vi.fn() };
    engine = new TaskEngine(mockStorage, mockCapture, mockMatcher, mockClicker);
  });

  it('starts with idle status', () => {
    expect(engine.getStatus('t1')).toBe('idle');
  });

  it('runs a task and completes', async () => {
    await engine.start('t1');
    expect(engine.getStatus('t1')).toBe('completed');
    expect(mockCapture.capture).toHaveBeenCalled();
    expect(mockMatcher.match).toHaveBeenCalled();
  });

  it('handles match result branching to END_TASK', async () => {
    mockMatcher.match.mockResolvedValue({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 });
    await engine.start('t1');
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('handles miss result branching to END_TASK', async () => {
    mockMatcher.match.mockResolvedValue({ matched: false });
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
    ]);
    await engine.start('t1');
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('stops a running task', async () => {
    const promise = engine.start('t1');
    engine.stop('t1');
    await promise;
    expect(engine.getStatus('t1')).toBe('stopped');
  });
});
```

- [ ] **Step 2: Implement task-engine.ts**

```typescript
import type { Task, Step, StepTransition, TaskSettings } from '@shared/types/task';
import type { MatchResult, GroupMatchResult } from '@shared/types/match-result';
import type { StorageService } from './storage';
import type { CaptureService } from './capture';
import type { MatcherClient } from './matcher-client';
import type { Logger } from './logger';

export type TaskRunStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';

interface StepContext {
  variables: Map<string, MatchResult>;
  lastScreenshot: string | null;
  currentStepId: string | null;
  groupLoopCounters: Map<string, number>;
}

export class TaskEngine {
  private statuses = new Map<string, TaskRunStatus>();
  private abortControllers = new Map<string, AbortController>();
  private storage: StorageService;
  private capture: CaptureService;
  private matcher: MatcherClient;
  private logger?: Logger;

  constructor(storage: StorageService, capture: CaptureService, matcher: MatcherClient, logger?: Logger) {
    this.storage = storage;
    this.capture = capture;
    this.matcher = matcher;
    this.logger = logger;
  }

  getStatus(taskId: string): TaskRunStatus {
    return this.statuses.get(taskId) || 'idle';
  }

  async start(taskId: string): Promise<void> {
    const task = this.storage.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const steps = this.storage.listSteps(taskId);
    if (steps.length === 0) {
      this.statuses.set(taskId, 'completed');
      return;
    }

    this.statuses.set(taskId, 'running');
    const abort = new AbortController();
    this.abortControllers.set(taskId, abort);

    const ctx: StepContext = {
      variables: new Map(),
      lastScreenshot: null,
      currentStepId: null,
      groupLoopCounters: new Map(),
    };

    try {
      await this.executeSteps(taskId, steps, task.settings, ctx, abort.signal);
    } catch (err: any) {
      if (err.message === 'STOPPED') {
        this.statuses.set(taskId, 'stopped');
      } else {
        this.statuses.set(taskId, 'failed');
        this.logger?.error('TaskEngine', `Task ${taskId} failed: ${err.message}`);
      }
    } finally {
      this.abortControllers.delete(taskId);
    }
  }

  stop(taskId: string): void {
    this.statuses.set(taskId, 'stopped');
    this.abortControllers.get(taskId)?.abort();
  }

  private async executeSteps(
    taskId: string,
    steps: Step[],
    settings: TaskSettings,
    ctx: StepContext,
    signal: AbortSignal,
  ): Promise<void> {
    const stepsById = new Map(steps.map(s => [s.id, s]));
    let currentStep = steps[0];
    const startTime = Date.now();

    while (currentStep) {
      if (signal.aborted) throw new Error('STOPPED');
      if (Date.now() - startTime > settings.globalTimeoutMs) {
        this.statuses.set(taskId, 'failed');
        return;
      }

      ctx.currentStepId = currentStep.id;

      // Interrupt handler check
      await this.checkInterrupts(taskId, settings, ctx, signal);

      // Screenshot
      if (currentStep.screenshotBeforeMatch || !ctx.lastScreenshot) {
        ctx.lastScreenshot = await this.capture.capture();
      }

      // Execute step
      const result = await this.executeStep(taskId, currentStep, ctx, settings, signal);
      const transition = result ? currentStep.onMatch : currentStep.onMiss;

      // Handle transition
      if (transition.action === 'END_TASK') {
        this.statuses.set(taskId, 'completed');
        return;
      }
      if (transition.action === 'END_GROUP_LOOP') {
        // Handled in step group logic
        break;
      }

      if (transition.nextStepId) {
        currentStep = stepsById.get(transition.nextStepId)!;
      } else {
        // Move to next step by order
        const idx = steps.indexOf(currentStep);
        if (idx < steps.length - 1) {
          currentStep = steps[idx + 1];
        } else {
          this.statuses.set(taskId, 'completed');
          return;
        }
      }
    }
  }

  private async executeStep(
    taskId: string,
    step: Step,
    ctx: StepContext,
    settings: TaskSettings,
    signal: AbortSignal,
  ): Promise<boolean> {
    const stepTimeout = settings.stepTimeoutMs;

    const timeoutPromise = new Promise<boolean>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('STEP_TIMEOUT')), stepTimeout);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('STOPPED')); });
    });

    const execPromise = this.executeStepInner(taskId, step, ctx);

    try {
      return await Promise.race([execPromise, timeoutPromise]);
    } catch (err: any) {
      if (err.message === 'STEP_TIMEOUT') {
        this.logger?.warn('TaskEngine', `Step ${step.id} timed out`);
        return false;
      }
      throw err;
    }
  }

  private async executeStepInner(taskId: string, step: Step, ctx: StepContext): Promise<boolean> {
    switch (step.type) {
      case 'IMAGE_MATCH': {
        const config = step.config as any;
        const result = await this.matcher.match({
          screenshot: ctx.lastScreenshot!,
          template: config.templatePath,
          threshold: config.threshold,
          scaleRange: config.scaleRange,
          region: config.captureRegion,
        });
        if (result.matched) {
          ctx.variables.set(step.id, result);
        }
        return result.matched;
      }
      case 'IMAGE_GROUP': {
        const config = step.config as any;
        const result = await this.matcher.matchGroup({
          screenshot: ctx.lastScreenshot!,
          templates: config.templates,
          logic: config.logic,
          scaleRange: config.scaleRange,
        });
        const allMatched = result.results.every(r => r.matched);
        const anyMatched = result.results.some(r => r.matched);
        return config.logic === 'ALL' ? allMatched : anyMatched;
      }
      case 'CLICK': {
        const config = step.config as any;
        let x: number, y: number;
        if (config.source === 'from_step' && config.stepId) {
          const matchResult = ctx.variables.get(config.stepId);
          if (!matchResult) return false;
          x = matchResult.x!;
          y = matchResult.y!;
        } else {
          x = config.fixedCoords.x;
          y = config.fixedCoords.y;
        }
        // Clicker would be called here
        return true;
      }
      default:
        return false;
    }
  }

  private async checkInterrupts(
    taskId: string,
    settings: TaskSettings,
    ctx: StepContext,
    signal: AbortSignal,
  ): Promise<void> {
    if (!settings.interruptHandlers || settings.interruptHandlers.length === 0) return;
    // Interrupt checking would scan for popup templates
    // Stubbed for now - will be fully implemented with the clicker integration
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx vitest run src/main/services/__tests__/task-engine.test.ts
git add src/main/services/task-engine.ts src/main/services/__tests__/task-engine.test.ts
git commit -m "feat: add TaskEngine with step execution, branching, and timeout support"
```

---

## Task 3: Task Group Engine

**Files:**
- Create: `src/main/services/task-group-engine.ts`
- Create: `src/main/services/__tests__/task-group-engine.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskGroupEngine } from '../task-group-engine';

describe('TaskGroupEngine', () => {
  let engine: TaskGroupEngine;
  let mockStorage: any;
  let mockTaskEngine: any;

  beforeEach(() => {
    mockStorage = {
      getTaskGroup: vi.fn().mockReturnValue({ id: 'g1', name: 'Group', failurePolicy: 'STOP', retryCount: 0 }),
      listTaskGroupItems: vi.fn().mockReturnValue([
        { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 1 },
        { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 2 },
      ]),
      getTask: vi.fn().mockReturnValue({ id: 't1', name: 'Task' }),
    };
    mockTaskEngine = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      getStatus: vi.fn().mockReturnValue('completed'),
    };
    engine = new TaskGroupEngine(mockStorage, mockTaskEngine);
  });

  it('executes tasks serially', async () => {
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(2);
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(1, 't1');
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(2, 't2');
  });

  it('stops on failure with STOP policy', async () => {
    mockTaskEngine.getStatus.mockReturnValueOnce('failed').mockReturnValueOnce('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(1);
  });

  it('skips failure with SKIP policy', async () => {
    mockStorage.getTaskGroup.mockReturnValue({ id: 'g1', name: 'Group', failurePolicy: 'SKIP', retryCount: 0 });
    mockTaskEngine.getStatus.mockReturnValueOnce('failed').mockReturnValueOnce('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(2);
  });

  it('retries on failure with RETRY policy', async () => {
    mockStorage.getTaskGroup.mockReturnValue({ id: 'g1', name: 'Group', failurePolicy: 'RETRY', retryCount: 2 });
    mockTaskEngine.getStatus.mockReturnValueOnce('failed').mockReturnValueOnce('completed').mockReturnValueOnce('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(3); // t1 fail, t1 retry, t2
  });
});
```

- [ ] **Step 2: Implement task-group-engine.ts**

```typescript
import type { FailurePolicy } from '@shared/types/task-group';
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
    this.running.set(taskGroupId, true);

    for (const item of items) {
      if (!this.running.get(taskGroupId)) break;

      const success = await this.executeWithPolicy(
        item.taskId,
        group.failurePolicy,
        group.retryCount,
      );

      if (!success && group.failurePolicy === 'STOP') {
        break;
      }
    }

    this.running.delete(taskGroupId);
  }

  stop(taskGroupId: string): void {
    this.running.set(taskGroupId, false);
  }

  private async executeWithPolicy(
    taskId: string,
    policy: FailurePolicy,
    retryCount: number,
  ): Promise<boolean> {
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      await this.taskEngine.start(taskId);
      const status = this.taskEngine.getStatus(taskId);

      if (status === 'completed') return true;
      if (status === 'stopped') return false;

      if (status === 'failed') {
        if (policy === 'RETRY' && attempt < retryCount) {
          continue;
        }
        return policy === 'SKIP';
      }
    }
    return false;
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx vitest run src/main/services/__tests__/task-group-engine.test.ts
git add src/main/services/task-group-engine.ts src/main/services/__tests__/task-group-engine.test.ts
git commit -m "feat: add TaskGroupEngine with serial execution and failure policies"
```

---

## Task 4: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Verify git status**

```bash
git status
```

All files committed.
