## Why

The assistant module has grown organically and needs a comprehensive overhaul to improve usability and add missing capabilities. Current pain points:

- Editing tasks and task groups requires multiple clicks through buttons; no quick access via double-click.
- Step groups lack conditional execution logic — steps can only loop sequentially, not branch based on match/miss results.
- IMAGE_MATCH steps always re-execute the full screenshot + match cycle, even when the result hasn't changed, causing unnecessary latency.
- CLICK steps carry unused onMatch/onMiss transition fields that add configuration noise.
- The real-time comparison toggle (re-capture vs reuse screenshot) exists at the task level but should be a per-step decision.

## What Changes

- **Double-click editing**: TaskList and TaskGroupList support double-click to open an editor drawer/modal for the selected item.
- **Step group conditional execution**: Step groups support branching — IMAGE_MATCH/IMAGE_GROUP steps can route to different subsequent steps based on match/miss results, in addition to the existing sequential loop behavior.
- **CLICK step simplification**: CLICK steps no longer carry onMatch/onMiss transitions. They always proceed to the next step in order.
- **Coordinate caching**: IMAGE_MATCH results are cached per task execution. Subsequent steps (CLICK or re-matching) can use cached coordinates instead of re-executing the match. Cache invalidates on browser window resize or manual clear.
- **Per-step real-time comparison toggle**: Each IMAGE_MATCH/IMAGE_GROUP step can independently choose whether to re-capture the browser screenshot before matching, or reuse the previous screenshot.
- **Step transition options**: Steps can transition to a specific step, end the current step group (only if inside a group), or end the task. Retry on miss is also supported.

## Non-goals

- No parallel step execution within step groups.
- No changes to the Python image-matching service — all changes are in the Electron app.
- No changes to task group orchestration (already complete with drag-and-drop, jump targets, loop settings).
- No changes to interrupt handler logic.
- No changes to network monitoring, logging, or import/export features.

## Capabilities

### New Capabilities

- `coordinate-caching`: Cache IMAGE_MATCH coordinates during task execution. Coordinates are reused when the same template is matched again, avoiding redundant screenshot + match cycles. Cache invalidates on browser window resize or manual clear. Purpose: performance optimization.

- `step-group-conditional`: Extend step groups with conditional execution paths. IMAGE_MATCH/IMAGE_GROUP steps can define separate onMatch and onMiss targets that route to different steps within the group, enabling match-based branching alongside the existing sequential loop model.

- `drawer-editing`: Replace button-based edit navigation with double-click to open an editor drawer for tasks and task groups in their respective list views.

### Modified Capabilities

- `task-engine`: Add per-step real-time comparison toggle (re-capture vs reuse screenshot). Simplify CLICK steps by removing onMatch/onMiss transitions — CLICK always proceeds to the next ordered step. Add END_STEP_GROUP as a transition action (only available when step is inside a step group). Integrate coordinate caching into the match execution flow.

- `persistence`: Add new columns to steps table for real-time comparison toggle and coordinate cache settings. Schema migration required.

## Impact

- **UI components**: TaskList, TaskGroupList (double-click handler), StepEditor (new toggles), TaskEditor (step group conditional config).
- **Main process**: TaskEngine execution flow changes for coordinate caching, conditional branching, and CLICK simplification.
- **Database**: New columns on steps table; migration script needed.
- **IPC channels**: New channel for manual coordinate cache clear; possible resize event forwarding from BrowserPanel.
- **Shared types**: StepTransition action types expanded; CLICK config simplified; new fields on Step type.
