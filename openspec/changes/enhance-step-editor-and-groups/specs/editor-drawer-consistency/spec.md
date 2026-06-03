## ADDED Requirements

### Requirement: Edit button and double-click open the same Drawer
The edit button and the row double-click handler in TaskList and TaskGroupList SHALL trigger the identical Drawer state. There SHALL be no separate full-panel editor view.

#### Scenario: Edit button opens Drawer
- **WHEN** the user clicks the edit button on a task row
- **THEN** the TaskList Drawer opens with the TaskEditor for that task

#### Scenario: Double-click opens the same Drawer
- **WHEN** the user double-clicks the same task row
- **THEN** the same Drawer with the same TaskEditor opens; the behavior is indistinguishable from the edit button path

#### Scenario: Task group editor parity
- **WHEN** the user either clicks the edit button or double-clicks a task group row
- **THEN** the TaskGroupList Drawer opens with the TaskGroupEditor; both entry points produce the same Drawer

### Requirement: Full-panel editor view is removed
The right-panel views previously addressed by `'task-editor'` and `'group-editor'` SHALL be removed. The top-bar switch SHALL only toggle between the tasks list and the task groups list.

#### Scenario: Top-bar toggle scopes to lists only
- **WHEN** the user switches between "任务" and "任务组" in the top bar
- **THEN** the right panel renders only TaskList or TaskGroupList; no other view is reachable from the top bar

#### Scenario: No stale editor view after Drawer close
- **WHEN** the user closes the editor Drawer
- **THEN** the right panel returns to the corresponding list view; the previous full-panel editor route does not appear

### Requirement: Drawer state is owned by the list component
The Drawer open/close state SHALL be local to TaskList / TaskGroupList. Parent components SHALL NOT need to coordinate Drawer state.

#### Scenario: List components manage their own Drawer
- **WHEN** the user opens, closes, or re-opens the editor Drawer
- **THEN** all state transitions are handled within the list component; no `onEdit` prop is required from the parent for the Drawer to function

#### Scenario: Closing Drawer does not affect list selection
- **WHEN** the user closes the Drawer
- **THEN** the list scroll position and any selection state are preserved
