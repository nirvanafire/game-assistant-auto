## ADDED Requirements

### Requirement: Step group creation from TaskEditor
TaskEditor SHALL expose a "+ 添加步骤组" button that opens a Modal collecting `name` (required) and `loopCount` (number, 0 = infinite). On submit, the system SHALL invoke `step-group:create` and refresh the group list.

#### Scenario: Open create modal
- **WHEN** the user clicks "+ 添加步骤组"
- **THEN** a Modal opens with empty `name` and `loopCount = 1` defaults

#### Scenario: Create succeeds
- **WHEN** the user enters a name and submits
- **THEN** the IPC `step-group:create` is invoked with `{ taskId, name, loopCount }`; on success the Modal closes and the new group appears in the step list area

#### Scenario: Empty name blocks submit
- **WHEN** the user submits with an empty `name`
- **THEN** the form rejects with an inline error; no IPC call is made

### Requirement: Step group edit and delete
Each group card SHALL expose edit and delete actions. Edit reuses the create Modal pre-filled with current values. Delete confirms, then sets `group_id = NULL` on contained steps and removes the group row.

#### Scenario: Edit updates name and loop count
- **WHEN** the user clicks the edit icon on a group card and submits new values
- **THEN** `step-group:update` is invoked with `{ stepGroupId, patch }` and the card reflects the new values

#### Scenario: Delete confirmation flow
- **WHEN** the user clicks the delete icon on a group card
- **THEN** a confirmation prompt appears asking whether to delete the group; steps inside are not deleted

#### Scenario: Delete ungroups contained steps
- **WHEN** the user confirms deletion of a group that contains three steps
- **THEN** the three steps' `group_id` becomes `NULL`; they appear in the "（未分组）" section; the group card disappears

#### Scenario: Cancelling delete preserves state
- **WHEN** the user dismisses the confirmation prompt
- **THEN** the group and its steps remain unchanged

### Requirement: Step list rendered by group
TaskEditor SHALL render steps in two layers: each step group as a labeled card containing its steps in `order`, and a single "（未分组）" section for steps with `groupId === null`. Each card SHALL provide "+ 在该组添加步骤"; the toolbar SHALL provide "+ 添加步骤" for ungrouped creation.

#### Scenario: Group card shows contained steps
- **WHEN** a task has a step group `g1` with two steps inside
- **THEN** the editor renders a card titled with `g1.name`, with both steps listed inside the card

#### Scenario: Loop count displayed as tag
- **WHEN** a group's `loopCount > 0`
- **THEN** the card header shows a tag like "循环 ×3"; if `loopCount === 0` it shows "循环 ∞"

#### Scenario: Ungrouped section appears when applicable
- **WHEN** at least one step has `groupId === null`
- **THEN** a section titled "（未分组）" appears with those steps; the section is omitted when all steps belong to groups

#### Scenario: Group order follows minimum step order
- **WHEN** group A's earliest step has `order = 2` and group B's earliest is `order = 5`
- **THEN** group A's card renders before group B's card; ungrouped steps interleave with group cards by their own `order` only at the section boundary, not inside cards

#### Scenario: Empty group renders at the end of the group section
- **WHEN** a step group has been created but contains no steps yet
- **THEN** its card appears after all non-empty groups in the group section; the card body shows an empty hint and the "+ 在该组添加步骤" button

### Requirement: Add-step buttons scope to the right group
The "+ 在该组添加步骤" button SHALL pass the group's `id` into the StepEditor instance so the new step is created with that `groupId`. The toolbar "+ 添加步骤" SHALL create the step with `groupId === undefined`.

#### Scenario: In-group add assigns groupId
- **WHEN** the user clicks "+ 在该组添加步骤" on group `g1` and saves a new step
- **THEN** the persisted step's `groupId === 'g1'`

#### Scenario: Toolbar add leaves step ungrouped
- **WHEN** the user clicks the toolbar "+ 添加步骤" and saves
- **THEN** the persisted step's `groupId` is undefined / NULL

#### Scenario: StepEditor does not show groupId field
- **WHEN** the user opens StepEditor (whether for new or existing step)
- **THEN** there is no UI control to change the step's `groupId`; the group context is determined by the entry point only

### Requirement: Step group IPC channels
The system SHALL expose four IPC channels for step-group management. Each SHALL be invokable from the renderer.

#### Scenario: List groups for a task
- **WHEN** the renderer invokes `step-group:list` with `{ taskId }`
- **THEN** the response is `{ groups: StepGroup[] }` sorted by creation order or id

#### Scenario: Create group
- **WHEN** the renderer invokes `step-group:create` with `{ taskId, name, loopCount }`
- **THEN** the response is `{ group: StepGroup }` containing the new id

#### Scenario: Update group
- **WHEN** the renderer invokes `step-group:update` with `{ stepGroupId, patch }`
- **THEN** the row is updated with the patch fields; void return

#### Scenario: Delete group ungroups steps first
- **WHEN** the renderer invokes `step-group:delete` with `{ stepGroupId }`
- **THEN** all steps whose `group_id` matches are updated to `group_id = NULL`, then the group row is deleted; void return

### Requirement: Reloading groups after CUD
After any successful create, update, or delete operation, TaskEditor SHALL re-fetch the group list and the step list so the UI reflects the new state.

#### Scenario: Create triggers reload
- **WHEN** `step-group:create` resolves
- **THEN** TaskEditor invokes `step-group:list` and `step:list` again, updating its rendered state

#### Scenario: Delete triggers reload
- **WHEN** `step-group:delete` resolves
- **THEN** TaskEditor invokes `step-group:list` and `step:list` again so newly ungrouped steps appear in the "（未分组）" section
