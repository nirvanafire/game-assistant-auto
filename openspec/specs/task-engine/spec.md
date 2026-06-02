# Spec: Task Engine

## Overview

Executes automated game workflows composed of steps. Supports branching logic, step groups with loops, interrupt handling, variable capture between steps, and task groups for serializing multiple tasks.

## Requirements

### Functional

1. Execute tasks composed of ordered steps
2. Step types: IMAGE_MATCH, IMAGE_GROUP, CLICK
3. Branching: each step has onMatch and onMiss transitions (next step or END_TASK)
4. Step groups: ordered subset of steps with loop count (0 = infinite)
5. Variable capture: IMAGE_MATCH results stored in task-scoped map; CLICK references "coords from step X"
6. Interrupt handlers: task-level pre-scan before each step; detected interrupts trigger handler action then retry
7. Loading screen detection: wait until loading screen template disappears
8. Screenshot control: per-step toggle for screenshot before match (default false, reuse last screenshot)
9. Task lifecycle: idle → running → paused/completed/failed/stopped
10. Step timeout and task global timeout
11. Execution history: each run logged with timestamps, step results, and errors
12. Task groups: named sequences of tasks executed serially
13. Task group failure policy: STOP (terminate group), SKIP (skip failed task, continue), RETRY (retry failed task N times)
14. Same task can be added to a task group multiple times
15. Task can belong to multiple task groups simultaneously
16. Task group execution state is independent of task status (task status unchanged when run as part of a group)

### Detailed Requirements

#### Task lifecycle
The system SHALL manage task execution with states: idle, running, paused, completed, failed, stopped.

- **Start task**: WHEN a task with valid steps is started, THEN status changes to running and execution begins from the first step
- **Stop task**: WHEN user stops a running task, THEN status changes to stopped and execution halts immediately

#### Step types
The system SHALL support three step types: IMAGE_MATCH, IMAGE_GROUP, and CLICK.

- **IMAGE_MATCH step**: capture a screenshot, match the template, store the result
- **CLICK step**: simulate a mouse click at the specified coordinates

#### Step branching
Each step SHALL have onMatch and onMiss transitions that specify the next step or end the task.

- **Match leads to next step**: WHEN IMAGE_MATCH finds a match and onMatch.nextStepId is set, THEN execution continues to the specified next step
- **Miss ends task**: WHEN IMAGE_MATCH finds no match and onMiss.action is "END_TASK", THEN the task completes

#### Step groups
The system SHALL support grouping steps with a loop count (0 = infinite).

- **Step group with loop**: loopCount=3 means steps execute 3 times before continuing
- **Infinite loop**: loopCount=0 means steps repeat until manually stopped

#### Variable capture
The system SHALL store image match results in a task-scoped variable map. CLICK steps SHALL reference coordinates from a previous step.

- **Click uses captured coordinates**: step 1 (IMAGE_MATCH) finds match at (100, 200), step 2 (CLICK) with source="from_step" clicks at (100, 200)

#### Interrupt handlers
The system SHALL scan interrupt handlers before each step. If an interrupt is detected, the handler action executes and the current step retries.

- **Interrupt detected**: WHEN a popup template matches before step execution, THEN the handler clicks to dismiss the popup and the current step retries

#### Task groups
The system SHALL support task groups that execute multiple tasks serially. The same task can appear multiple times in a group.

- **Serial execution**: tasks A, B, C execute in order
- **Same task repeated**: tasks A, B, A means A runs, then B, then A again

#### Task group failure policy
Task groups SHALL support failure policies: STOP (terminate group), SKIP (skip failed task), RETRY (retry N times).

- **STOP policy**: task B fails → group stops, task C does not execute
- **SKIP policy**: task B fails → task B is skipped, task C executes
- **RETRY policy**: task B fails with retryCount=2 → task B is retried up to 2 times

#### State isolation
Task status SHALL remain independent of task group execution. Task group tracks its own execution progress.

#### Screenshot control
Each step SHALL have an optional screenshotBeforeMatch flag. When false (default), the step reuses the last screenshot.

#### Step timeout and task timeout
The system SHALL enforce per-step and per-task timeouts.

- **Step timeout**: step does not complete within stepTimeoutMs → step fails, follows onMiss transition
- **Task global timeout**: task does not complete within globalTimeoutMs → task stops with status failed

### Non-functional

1. Task engine runs in main process (not renderer)
2. Step execution is async, non-blocking
3. Python service health checked before task start
4. Auto-restart Python subprocess if it crashes during task execution

## Data Model

### TaskGroup

```typescript
interface TaskGroup {
  id: string;
  name: string;
  failurePolicy: 'STOP' | 'SKIP' | 'RETRY';
  retryCount: number;  // only used when failurePolicy is RETRY
}

interface TaskGroupItem {
  id: string;
  taskGroupId: string;
  taskId: string;
  order: number;
  // No UNIQUE constraint on (taskGroupId, taskId) — same task can appear multiple times
}

interface TaskGroupRun {
  id: string;
  taskGroupId: string;
  startedAt: Date;
  endedAt?: Date;
  result?: 'completed' | 'failed' | 'stopped';
  items: TaskGroupItemRun[];
}

interface TaskGroupItemRun {
  itemOrder: number;
  taskId: string;
  result?: 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  endedAt?: Date;
  taskRunId?: string;  // reference to the task_runs entry
}
```

### Task

```typescript
interface Task {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  settings: {
    screenshotBeforeMatch: boolean;  // default false
    maxRetries: number;              // default 3
    globalTimeoutMs: number;         // default 0 (no limit)
    stepTimeoutMs: number;           // default 30000
  };
  interruptHandlers: InterruptHandler[];
}
```

### Step

```typescript
interface Step {
  id: string;
  taskId: string;
  type: 'IMAGE_MATCH' | 'IMAGE_GROUP' | 'CLICK';
  order: number;
  groupId?: string;
  config: ImageMatchConfig | ImageGroupMatchConfig | ClickConfig;
  onMatch: StepTransition;
  onMiss: StepTransition;
  screenshotBeforeMatch: boolean;
}

interface StepTransition {
  nextStepId?: string;
  action?: 'END_TASK' | 'END_GROUP_LOOP';
}
```

### Step Group

```typescript
interface StepGroup {
  id: string;
  taskId: string;
  name: string;
  loopCount: number;  // 0 = infinite
}
```

### Interrupt Handler

```typescript
interface InterruptHandler {
  id: string;
  label: string;
  templatePath: string;
  threshold: number;
  action: 'CLICK_AT_MATCH' | 'CLICK_FIXED' | 'SKIP';
  fixedCoords?: { x: number; y: number };
  priority: number;
}
```

## Execution Flow

### TaskGroup Execution

```
startTaskGroup(taskGroupId):
  1. Validate task group has items
  2. Check Python service health
  3. Create TaskGroupRun record
  4. For each item (ordered by "order"):
     a. If stopped by user → set result=stopped, break
     b. Start task execution (startTask(item.taskId))
     c. Wait for task to complete
     d. Record item result in TaskGroupItemRun
     e. If task failed:
        - failurePolicy=STOP → set result=failed, break
        - failurePolicy=SKIP → record skipped, continue
        - failurePolicy=RETRY → retry up to retryCount times
     f. If task completed → continue to next item
  5. Set TaskGroupRun final result
  6. Emit task-group:status-changed to renderer
```

### Task Execution
  1. Validate task has steps
  2. Check Python service health
  3. Set status = RUNNING
  4. Get first step (lowest order, no group)
  5. Execute step loop:
     a. Check global timeout
     b. Check interrupt handlers (sorted by priority)
        - If interrupt matched: execute handler action, retry current step
     c. Execute step based on type:
        - IMAGE_MATCH: capture → match → store result → branch
        - IMAGE_GROUP: capture → match group → store result → branch
        - CLICK: resolve coordinates → simulate click → next step
     d. Log step result
     e. Follow onMatch or onMiss transition
     f. If in step group: advance or loop back
     g. If END_TASK or no next step: complete
  6. Set final status
  7. Save run history
```

## Click Injection

- Use `webContents.sendInputEvent()` for mouse events
- Event types: `mouseDown`, `mouseUp`, `mouseMove`
- Support left/right button, single/double click
- Coordinates are relative to the browser content area

## State Persistence

- Task definitions stored in SQLite (tasks, steps, step_groups tables)
- Task group definitions stored in SQLite (task_groups, task_group_items tables)
- Task run history stored in task_runs table
- Task group run history stored in task_group_runs table
- In-memory execution state (current step, variable map) not persisted across app restart
