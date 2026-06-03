# Proposal: Enhance Right Panel - Chinese UI & Task Group Orchestration

## Summary

Optimize the right-side tool panel with two goals:
1. Localize all right-panel UI strings to Chinese
2. Enhance task group orchestration with drag-and-drop ordering, per-item conditional branching, and group-level looping

## Motivation

- Current UI is entirely in English, but the target user base is Chinese-speaking
- Task groups currently support only linear sequential execution with a group-level failure policy
- Users need more sophisticated orchestration: conditional branching based on task results, looping for repetitive workflows, and easy reordering of tasks within a group

## Scope

### In Scope

**Chinese Localization (right panel only):**
- Tab labels, buttons, form labels, status tags, error messages, placeholders
- Components: App.tsx tabs, TaskList, TaskGroupList, TaskGroupEditor, TaskEditor, StepEditor, ExecutionStatus, LogViewer, ImageCompare, ClickTest, NetworkLog

**Task Group Orchestration:**
- Data model: extend `task_groups` with loop fields, extend `task_group_items` with conditional jump targets
- Execution engine: rewrite `TaskGroupEngine` to support conditional branching and looping
- UI: redesign `TaskGroupEditor` with drag-and-drop task list, per-item success/failure jump configuration, and loop settings
- Add `@dnd-kit/core` and `@dnd-kit/sortable` dependencies for drag-and-drop

### Non-Goals

- i18n framework (react-i18next etc.) — not needed for single-language support
- Visual flow-chart / node-graph editor — too complex for current scope
- Per-task-item looping — looping is at group level only
- Parallel task execution within a group — sequential with branching only
- Chinese localization for BrowserPanel toolbar or main process logs

## Design Decisions

1. **Direct string replacement** over i18n framework — simpler, no extra dependency
2. **Per-item conditional jumps** (`on_success` / `on_failure`) over group-level failure policy — more flexible
3. **List + condition panel** UI over visual flow chart — simpler to implement and maintain
4. **@dnd-kit** for drag-and-drop — standard React DnD library, works well with Ant Design
5. **Loop at group level** — interval + max iterations, simpler than per-item loops

## Risks

1. **DB migration** — new columns must have safe defaults; existing data preserved
2. **Loop stop mechanism** — must ensure `stop()` correctly interrupts loop wait
3. **Drag-and-drop + conditional refs** — jumps reference item IDs (not order), so reordering doesn't break logic
