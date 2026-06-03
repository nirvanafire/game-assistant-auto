## Why

The assistant module's editor layer has grown unevenly. Editing entry points diverge (button vs double-click), template image paths must be typed by hand with no asset management, three execution toggles stack vertically and clutter the form, the IMAGE_GROUP type has no editable UI at all, default transition actions are unset (forcing every step to be configured), and step groups exist in the data model but have no creation surface in the UI. These gaps slow down task authoring and produce inconsistent runtime behavior.

## What Changes

- **Editor entry consistency**: TaskList and TaskGroupList route both edit-button clicks and double-clicks into the same Drawer. The full-panel editor view is retired.
- **Template image persistence**: Manual path input and a "pick image" button coexist. Whichever route the user takes, the image is copied into a managed `templates/` directory under userData with a regenerated UUID filename. The saved `templatePath` always points inside this directory.
- **Horizontal toggle layout**: The three step toggles (fresh screenshot, realtime match, cache coordinates) are laid out horizontally with equal widths. Cache coordinates defaults to ON for new steps.
- **CLICK type slim form**: For CLICK steps, none of the three toggles are shown; the transition cards remain hidden (already in progress).
- **Image group match editor**: IMAGE_GROUP is relabeled "图像组匹配" in the UI and gains a full editor: multi-template list, per-template label/path/threshold, and an ALL/ANY logic switch.
- **Transition defaults and "无" semantics**: Adds a new `NEXT_STEP` action. New steps default to `onMatch=NEXT_STEP`, `onMiss=undefined`. The engine treats an undefined transition (the "无" UI option) as "stop the task", not "advance".
- **Step group management UI**: TaskEditor exposes "+ 添加步骤组" and renders steps grouped by their `groupId` in collapsible cards. Group CRUD goes through new IPC handlers; deleting a group ungroups its steps.

## Non-goals

- No changes to the Python matching service or the matcher protocol.
- No drag-and-drop reordering of steps across groups (manual reassignment is out of scope this round).
- No orphan template image cleanup tool.
- No parallel execution within step groups.
- No changes to task group orchestration, interrupt handlers, network monitoring, or logging.

## Capabilities

### New Capabilities

- `editor-drawer-consistency`: Both the edit button and the double-click handler on TaskList / TaskGroupList open the same Drawer. The full-panel editor view is removed; the top-bar toggle only switches between the tasks and task-groups lists.

- `template-image-storage`: A `template-storage` service in the main process owns a `templates/` directory under `app.getPath('userData')`. Any `templatePath` saved through StepEditor is normalized to a path inside this directory; external paths are copied and renamed with a fresh UUID + original extension. Image picking and normalization are exposed as IPC channels.

- `step-editor-layout`: StepEditor renders the three execution toggles in a horizontal row for IMAGE_MATCH and IMAGE_GROUP_MATCH types, hides all three for CLICK, and defaults `cacheCoordinates` to true for new steps.

- `image-group-match`: The IMAGE_GROUP step type gains a complete editor: a list of templates each with label / path / threshold, an ALL/ANY logic radio, shared timing/scaling fields, and the same transition cards as IMAGE_MATCH. The UI label is "图像组匹配"; the data-layer type identifier stays `IMAGE_GROUP`.

- `step-group-management`: TaskEditor exposes step group creation, edit, and delete. Steps are rendered grouped by `groupId` in collapsible cards, with ungrouped steps in a separate section. New IPC handlers cover step-group CRUD.

### Modified Capabilities

- `task-engine`: The transition model gains a `NEXT_STEP` action. The engine now distinguishes "explicitly stop here" (undefined transition) from "explicitly advance" (`NEXT_STEP`). Existing data is migrated to preserve current behavior.

- `persistence`: A migration backfills existing `on_match` / `on_miss` to `{"action":"NEXT_STEP"}` for IMAGE_MATCH and IMAGE_GROUP rows where the action is missing and `nextStepId` is empty, so existing tasks keep their current "advance on match/miss" behavior. CLICK rows are skipped.

## Impact

- **Shared types**: `StepTransition.action` adds `'NEXT_STEP'`.
- **Database**: Migration v4 backfills `on_match`/`on_miss` for existing IMAGE_MATCH and IMAGE_GROUP steps to `{"action":"NEXT_STEP"}` where currently empty/undefined. No new columns.
- **Main process**:
  - New service `src/main/services/template-storage.ts`.
  - New IPC handlers: `image:pick`, `image:normalize`, `step-group:list`, `step-group:create`, `step-group:update`, `step-group:delete`.
  - `task-engine.ts`: undefined transition no longer auto-advances; new `NEXT_STEP` branch.
- **Renderer**:
  - `App.tsx`: removes `task-editor`/`group-editor` view branches.
  - `TaskList.tsx` / `TaskGroupList.tsx`: edit button reuses the same Drawer trigger as double-click.
  - `StepEditor.tsx`: horizontal toggle row, image picker buttons, IMAGE_GROUP_MATCH editor, NEXT_STEP option, new defaults.
  - `TaskEditor.tsx`: step list reorganized by group; group CRUD UI; "+ 添加步骤组" button.
- **Preload / constants**: New IPC channel constants for image and step-group operations.
