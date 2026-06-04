## Context

The assistant module is the core feature of the game-assistant-auto Electron app. It manages tasks (composed of steps), step groups (looping subsets of steps), and task groups (orchestrated sequences of tasks). The current implementation covers basic sequential execution with branching via onMatch/onMiss transitions, but lacks conditional execution within step groups, coordinate caching for performance, and convenient editing UX.

Current state:
- Tasks, steps, step groups, task groups are fully persisted in SQLite.
- TaskEngine executes steps sequentially with branching via StepTransition.
- Step groups only support sequential looping (loopCount).
- Every IMAGE_MATCH step re-captures and re-matches from scratch.
- CLICK steps carry unused onMatch/onMiss fields.
- Editing requires button clicks to navigate to editor components.

## Goals / Non-Goals

**Goals:**
- Enable conditional execution paths within step groups (match → path A, miss → path B).
- Cache IMAGE_MATCH coordinates during task execution to skip redundant matching.
- Add per-step control over screenshot re-capture vs reuse.
- Simplify CLICK steps by removing unnecessary transition fields.
- Improve editing UX with double-click to open editor drawers.

**Non-Goals:**
- No parallel step execution.
- No changes to the Python matching service.
- No changes to task group orchestration logic.
- No changes to interrupt handlers, network monitoring, or logging.

## Decisions

### 1. Coordinate caching lives in TaskEngine, not in StorageService

The cache is ephemeral — it exists only during task execution and is not persisted to SQLite. TaskEngine already maintains in-memory execution state (current step, variable map). Adding a `Map<string, { x: number; y: number }>` keyed by template path is the simplest approach.

**Alternatives considered:**
- Persist cache to SQLite: Unnecessary complexity. Cache lifetime is a single task run. Window resize invalidates it anyway.
- Cache in renderer store: Wrong layer. Matching happens in main process.

### 2. Coordinate cache invalidation via BrowserPanel resize event

BrowserPanel detects webview resize and sends an IPC event (`browser:resized`) to the main process. TaskEngine listens for this event and clears its coordinate cache. This is simpler than polling or observing webContents bounds changes.

**Alternatives considered:**
- Monitor webContents bounds in main process: More complex, requires periodic checking.
- Invalidate per-step based on screenshot size comparison: Adds latency per step, doesn't catch same-size window moves.

### 3. Step group conditional execution via onMatch/onMiss targets

Rather than introducing a new "conditional node" abstraction, reuse the existing StepTransition model. Each IMAGE_MATCH/IMAGE_GROUP step's onMatch and onMiss can target:
- A specific step ID (within the same group or outside it)
- END_STEP_GROUP (exit the group loop)
- END_TASK (stop the task entirely)

CLICK steps have no transitions — they always proceed to the next ordered step.

**Alternatives considered:**
- New "branch node" type: Adds a new concept without clear benefit over extending transitions.
- DAG-based step graph: Over-engineered for the current use case. Sequential + branching covers the requirements.

### 4. Per-step screenshot toggle replaces task-level setting

The existing `TaskSettings.screenshotBeforeMatch` becomes a per-step field on IMAGE_MATCH and IMAGE_GROUP steps. The task-level setting is removed. This gives finer control — some steps need fresh screenshots (e.g., detecting UI state changes) while others can reuse (e.g., matching a static element).

**Migration**: Existing steps inherit the task-level value during migration.

### 5. Drawer-based editing for double-click

Double-click on a TaskList or TaskGroupList item opens an Ant Design Drawer component containing the existing TaskEditor or TaskGroupEditor. This reuses current editor components with minimal UI changes.

**Alternatives considered:**
- Inline editing: Too complex for step management (TaskEditor) or task orchestration (TaskGroupEditor).
- Right panel switch: Would conflict with the existing tab layout and lose context.

### 6. CLICK steps lose onMatch/onMiss, gain implicit next-step

CLICK steps always execute the next step in order (by `order` field). If a CLICK is the last step in a group, it ends the group loop. If it's the last step in the task, it ends the task. No explicit transition needed.

**Migration**: Existing CLICK steps with onMatch/onMiss values — those fields are ignored during execution. DB columns preserved for backward compatibility but not used for CLICK type.

## Risks / Trade-offs

- **[Coordinate cache staleness]** → If the page content shifts without a window resize (e.g., dynamic content loading), cached coordinates may point to wrong locations. **Mitigation**: Users can manually clear cache; the cache is opt-in per step, not default behavior.

- **[Step group complexity]** → Conditional execution paths within step groups increase the configuration surface. Users may create confusing branching logic. **Mitigation**: The UI will visually indicate match/miss paths; step group editor shows a clear flow representation.

- **[CLICK without transitions]** → Existing CLICK steps that relied on onMatch/onMiss for non-standard behavior (e.g., END_TASK after click) will silently lose that behavior. **Mitigation**: Migration script flags such steps for manual review; documentation clarifies the new model.

- **[Per-step screenshot toggle migration]** → Moving from task-level to per-step setting requires a migration that sets all existing steps to the task's current value. **Mitigation**: Safe default (false = reuse screenshot) matches current behavior when task-level was false.

## Migration Plan

1. Add new columns to `steps` table: `realtime_match` (boolean, default 0), `cache_coordinates` (boolean, default 0).
2. Populate `realtime_match` from each task's `settings.screenshotBeforeMatch` value.
3. Add `browser:resized` IPC channel.
4. No data loss — existing onMatch/onMiss on CLICK steps preserved in DB but ignored by engine.
5. Rollback: drop new columns, revert engine logic.

## Open Questions

- Should coordinate cache be visible to the user (e.g., a panel showing cached template → coordinate mappings)?
- Should there be a per-step "force re-match" option that ignores cache even when caching is enabled?
