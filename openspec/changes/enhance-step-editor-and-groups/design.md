## Context

This change builds on top of the in-flight `refactor-assistant-module` work. That change introduced drawer editing, per-step realtime match, coordinate caching, and CLICK simplification. The current round addresses the editor UX gaps that surfaced once those features landed: divergent edit entry points, hand-typed image paths with no asset management, vertically stacked toggles, an empty IMAGE_GROUP editor, missing transition defaults, and no surface for step group management. The changes are concentrated in StepEditor, TaskEditor, the two list components, a new template-storage service, and a small engine semantic adjustment.

## Goals / Non-Goals

**Goals:**
- Consolidate editor entry points: edit button and double-click open the same Drawer.
- Manage template images as first-class assets under `userData/templates/`.
- Make the three step toggles compact (horizontal) and adopt a sensible default for `cacheCoordinates`.
- Provide a complete editor for the IMAGE_GROUP step type, including ALL/ANY logic.
- Give transition actions meaningful defaults; clarify that "无" means "stop", not "advance".
- Expose step group creation, edit, delete in TaskEditor; render steps grouped by `groupId`.

**Non-Goals:**
- No drag-and-drop for steps between groups.
- No orphan image cleanup.
- No changes to the matcher service.
- No new transition action types beyond `NEXT_STEP`.
- No reuse-image deduplication (same source picked twice produces two copies).

## Decisions

### 1. Edit button and double-click converge on the same Drawer

The list components own a `drawerXxxId` state. Both the edit button's `onClick` and the row's `onDoubleClick` simply call `setDrawerXxxId(id)`. The `onEdit` prop is removed (or kept as a no-op callback for parent listeners). `App.tsx` retires its `'task-editor'` and `'group-editor'` view branches and only retains the `'tasks'` / `'groups'` switch in the top bar.

**Alternatives considered:**
- Modal instead of Drawer: rejected — TaskEditor and TaskGroupEditor are tall vertical forms; Drawer's side-panel format matches their height better and is already in use.
- Keep both edit modes (button = full view, double-click = drawer): rejected — the user explicitly asked for parity and the divergence is the bug being fixed.

### 2. Template images are normalized on save, not on input

Whether the user pastes a path or picks a file, the renderer collects `templatePath` as a string. At step save time, before sending `step:create` / `step:update`, the renderer calls `image:normalize` for every template path. The main process checks whether the path is already under `templates/`; if yes, it returns the same path, otherwise copies the file to `templates/<uuid><ext>` and returns the new path.

The picker button reuses the same flow: it triggers `image:pick` to get a source path, then `image:normalize` to copy it in, then writes the result into the form field.

**Rationale**: Normalizing on save (rather than on blur) avoids partial state where the form shows one path while the disk has another. It also keeps the picker code path identical to the manual entry path.

**Alternatives considered:**
- Copy on input blur: rejected — surprises the user with implicit copying mid-edit; complicates undo.
- Only copy via picker, leave manual paths as external references: rejected — the user explicitly required manual paths to also be copied.

### 3. Horizontal toggle row uses Space + equal-width Form.Items

The three toggles sit inside an antd `Space` (horizontal, `wrap`) container. Each `Form.Item` has its label on top and the `Switch` below, sharing equal width via flex. The `shouldUpdate` form-item already conditionally renders by step type — extending it to wrap all three toggles in one shared conditional block keeps the logic centralized.

**`cacheCoordinates` default change**: New steps' initialValues set `cacheCoordinates: true`. Existing rows are not retroactively flipped — they keep whatever value they had — because changing existing behavior silently is risky and the user only asked for the new-step default.

### 4. IMAGE_GROUP_MATCH uses the existing config shape

`ImageGroupMatchConfig` already supports `templates: Array<{label, templatePath, threshold}>` and `logic: 'ALL' | 'ANY'`. The editor exposes:
- A `Form.List` over `templates`, each item with label / path (+ pick button) / threshold.
- A `Radio.Group` for `logic` with labels "同时满足（全部匹配）" / "满足其一（任一匹配）". Default `ANY`.
- Shared timing/scaling fields (`delayMs`, `retryCount`, `retryIntervalMs`, `scaleRange`) below the template list.
- Transition cards (onMatch/onMiss) identical to IMAGE_MATCH.

The UI label "图像组匹配" replaces "图像组" in the type Select and the step list. The underlying `StepType` value stays `'IMAGE_GROUP'` to avoid a data migration. Validation: at least one template; each template requires label, templatePath, and a valid threshold.

### 5. Transition semantics: explicit NEXT_STEP, undefined means stop

The current engine treats undefined transition as "advance to next ordered step". The new model:

| Transition state                                  | Engine behavior                                |
|---------------------------------------------------|------------------------------------------------|
| `transition === undefined` or `action === undefined` | Task completes (no further steps run)        |
| `action === 'NEXT_STEP'`                          | Advance to next ordered step (within group if grouped) |
| `action === 'END_TASK'`                           | Task completes                                 |
| `action === 'END_STEP_GROUP'`                     | Exit current group loop, continue after group  |
| `nextStepId` set                                  | Jump to that step (action ignored if both set) |

**Rationale**: The user explicitly said "无 = 不执行后续步骤". Having undefined map to "advance" was a silent default that hid intent. Making both "advance" and "stop" explicit forces step authors to declare what should happen.

**New-step defaults**: `onMatch.action = 'NEXT_STEP'` (the common case), `onMiss.action = undefined` (so unconfigured miss halts).

### 6. Migration v4 preserves current behavior for existing steps

Without migration, existing IMAGE_MATCH/IMAGE_GROUP steps whose `on_match`/`on_miss` are `'{}'` (the current "undefined" representation) would suddenly halt instead of advancing — breaking every existing task.

Migration v4 walks the `steps` table:
- For each row where `type IN ('IMAGE_MATCH', 'IMAGE_GROUP')`:
  - If `on_match` is `NULL`, `''`, `'{}'`, or `json_extract(on_match, '$.action')` is null AND `json_extract(on_match, '$.nextStepId')` is null → set `on_match = '{"action":"NEXT_STEP"}'`.
  - Same for `on_miss`.
- CLICK rows are skipped (their transitions are ignored by the engine anyway).

Existing tasks therefore behave identically post-migration. Only new steps see the new defaults.

### 7. Step groups: create-first, then assign

The TaskEditor's steps area splits into:
- A toolbar: `+ 添加步骤组` and `+ 添加步骤` buttons.
- A list of step group cards, each with header (name + loop tag + edit/delete icons) and the group's steps inside, plus a `+ 在该组添加步骤` button at the bottom.
- An "（未分组）" section with the same shape, minus group icons.

Group create/edit uses a small Modal (name + loopCount). Group delete confirms, then sets `group_id = NULL` for all steps in that group and removes the row from `step_groups`. Steps are not deleted.

Each "添加步骤" button passes the target `groupId` (or undefined) into the StepEditor so the new step is created in the right group. StepEditor itself does not expose a `groupId` selector — the entry button decides.

**Display ordering**: Groups are sorted by the minimum `order` of their member steps (so a group's position in the list reflects where its first step sits). This avoids a new "group order" column on `step_groups`. Ungrouped steps interleave naturally by `order`.

**New IPC channels**:
- `step-group:list` — `{ taskId } → { groups: StepGroup[] }`
- `step-group:create` — `{ taskId, name, loopCount } → { group: StepGroup }`
- `step-group:update` — `{ stepGroupId, patch: Partial<StepGroup> } → void`
- `step-group:delete` — `{ stepGroupId } → void`

`step-group:delete` is the only one with non-trivial logic (must null out referenced steps' `group_id` before deleting the group row). The renderer reloads the group list after every CUD.

## Risks / Trade-offs

- **[Behavior shift on undefined transitions]** → If migration v4 misses any row (e.g., NULL handling differs across SQLite versions), affected steps will halt unexpectedly. **Mitigation**: migration test covers NULL, empty string, `'{}'`, partially populated JSON, and rows with valid actions. Manual smoke test against a dev DB before shipping.

- **[Template directory grows unboundedly]** → Every save copies a new file; orphans accumulate. **Mitigation**: out of scope this round; tracked as a future cleanup tool.

- **[Step group ordering by min(step.order) is implicit]** → Renaming or restructuring may surprise the user if step orders shift. **Mitigation**: documented in the design; if it proves confusing, a follow-up can add an explicit `group_order` column.

- **[Cross-group ordering ambiguity]** → If two groups have interleaved orders (e.g., group A steps at orders 1,3 and group B at order 2), rendering by min(order) places A before B but B's step would visually live "between" A's steps. **Mitigation**: this round renders group cards contiguous (all of A's steps together, then all of B's), accepting the slight inconsistency with the global order field. The engine still walks by `order`, so execution is unaffected.

- **[Manual path typed for non-existent file]** → Normalization fails on save; user gets an error. **Mitigation**: clear inline error message; form does not submit until the path resolves.

## Migration Plan

1. **Schema**: no new columns; `template-storage` directory is created at app startup if absent.
2. **Migration v4**: backfill `on_match`/`on_miss` for IMAGE_MATCH and IMAGE_GROUP rows where action and nextStepId are both missing → `'{"action":"NEXT_STEP"}'`. Update schema version to 4.
3. **No template image migration**: existing `templatePath` values remain valid as-is. They are only normalized when the step is re-saved (lazy migration).
4. **Rollback**: revert migration v4 (delete the backfilled action keys); revert renderer/main-process code; the `templates/` directory remains harmless on disk.

## Open Questions

- Should the StepEditor warn when a templatePath is normalized at save time (i.e., the file was copied), to make the asset management visible to the user?
- Should `step-group:delete` offer a destructive variant that also deletes the contained steps?
- For migration v4, should CLICK rows also be normalized to a sentinel value to make their unused transitions obvious in the DB, or left untouched?
