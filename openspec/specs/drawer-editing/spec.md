## ADDED Requirements

### Requirement: Double-click task to open editor drawer
Double-clicking a task item in the TaskList SHALL open an Ant Design Drawer containing the TaskEditor component for that task.

#### Scenario: Double-click opens task editor drawer
- **WHEN** user double-clicks a task item in the TaskList
- **THEN** a Drawer opens from the right side, containing the TaskEditor pre-loaded with the selected task's data

#### Scenario: Single click still selects task
- **WHEN** user single-clicks a task item in the TaskList
- **THEN** the task is selected (existing behavior), no drawer opens

### Requirement: Double-click task group to open editor drawer
Double-clicking a task group item in the TaskGroupList SHALL open an Ant Design Drawer containing the TaskGroupEditor component for that task group.

#### Scenario: Double-click opens task group editor drawer
- **WHEN** user double-clicks a task group item in the TaskGroupList
- **THEN** a Drawer opens from the right side, containing the TaskGroupEditor pre-loaded with the selected task group's data

#### Scenario: Single click still selects task group
- **WHEN** user single-clicks a task group item in the TaskGroupList
- **THEN** the task group is selected (existing behavior), no drawer opens

### Requirement: Drawer can be closed by user
The editor drawer SHALL be closeable via the close button, clicking the overlay mask, or pressing Escape.

#### Scenario: Close drawer via close button
- **WHEN** user clicks the Drawer's close button
- **THEN** the Drawer closes and the list view returns to normal interaction

#### Scenario: Close drawer via overlay click
- **WHEN** user clicks the mask overlay outside the Drawer
- **THEN** the Drawer closes

### Requirement: Edit changes persist on save
Changes made within the editor drawer SHALL be persisted when the user saves, without closing the drawer unless explicitly requested.

#### Scenario: Save task changes in drawer
- **WHEN** user edits a task name in the TaskEditor drawer and clicks save
- **THEN** the task is updated via IPC, the TaskList reflects the new name, and the drawer remains open

### Requirement: Existing edit buttons still work
The existing edit buttons in TaskList and TaskGroupList SHALL continue to open the same editor drawers. Double-click is an additional access method, not a replacement.

#### Scenario: Edit button opens same drawer as double-click
- **WHEN** user clicks the edit button on a task item
- **THEN** the same Drawer with TaskEditor opens, identical to double-click behavior
