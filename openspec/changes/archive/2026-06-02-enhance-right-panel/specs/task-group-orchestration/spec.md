# Spec: Task Group Orchestration

## Overview

Extend task groups with conditional branching, loop control, and drag-and-drop ordering.

## Data Model

### TaskGroup (extended)

New fields:
- `loopEnabled: boolean` — whether the group loops
- `loopIntervalMs: number` — delay between loop iterations in milliseconds
- `loopMaxIterations: number` — max iterations (0 = infinite)

### TaskGroupItem (extended)

New fields:
- `onSuccess: string | null` — jump target on task success
  - `null` → proceed to next item in order
  - `'END'` → end the group run
  - `{itemId}` → jump to that item
- `onFailure: string | null` — jump target on task failure
  - `null` → end the group run
  - `'END'` → end the group run
  - `{itemId}` → jump to that item

## Execution Rules

1. Execution starts from the first item (lowest `order`)
2. After each task completes, follow `onSuccess` or `onFailure` based on result
3. If jump target is `null`:
   - On success: go to next item in order
   - On failure: end the group
4. If jump target is `'END'`: end the group run
5. If jump target is an item ID: jump to that item
6. When reaching the end (no more items, or explicit END):
   - If `loopEnabled` and iterations remaining: wait `loopIntervalMs`, then restart from item 1
   - Otherwise: mark group run as completed
7. `stop()` interrupts execution immediately, including during loop wait

## UI Requirements

### TaskGroupEditor

1. **Basic info section**: name input, save button
2. **Loop settings section**:
   - Toggle to enable/disable looping
   - Interval input (in minutes, stored as ms)
   - Max iterations input (0 = infinite)
   - Save button for loop settings
3. **Task orchestration section**:
   - Drag-and-drop sortable list of task items
   - Each item shows: drag handle, order number, task name, delete button
   - Each item has two Select dropdowns:
     - "成功" → jump target (other items by name, or "结束")
     - "失败" → jump target (other items by name, or "结束")
   - Changes to jump targets are saved immediately on change
   - "添加任务" button at bottom with Select to pick from available tasks

### TaskGroupList

- Chinese labels for all buttons and text
- Show loop indicator if group has looping enabled

### Drag-and-Drop Behavior

- Drag handle on the left side of each item
- Visual feedback during drag (opacity change, drop indicator)
- On drop: update `order` for all items, persist via IPC
- Optimistic UI update

## IPC Channels

New channels needed:
- `task-group:update-loop` — update loop settings for a group
- `task-group:update-item-target` — update on_success/on_failure for an item
- `task-group:reorder-items` — update order for all items in a group

## Backward Compatibility

- Existing `failurePolicy` and `retryCount` fields preserved on TaskGroup
- Existing items with NULL on_success/on_failure behave as before (linear execution)
- DB migration adds columns with safe defaults (NULL / 0)
