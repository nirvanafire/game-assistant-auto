## MODIFIED Requirements

### Requirement: Step branching
Each IMAGE_MATCH or IMAGE_GROUP step SHALL have onMatch and onMiss transitions that specify the next step, end the task, or end the step group. CLICK steps SHALL NOT have transitions — they always proceed to the next ordered step.

#### Scenario: IMAGE_MATCH match leads to specified step
- **WHEN** IMAGE_MATCH finds a match and onMatch.nextStepId is set
- **THEN** execution continues to the specified next step

#### Scenario: IMAGE_MATCH miss ends task
- **WHEN** IMAGE_MATCH finds no match and onMiss.action is "END_TASK"
- **THEN** the task status changes to completed and execution stops

#### Scenario: IMAGE_MATCH match ends step group
- **WHEN** IMAGE_MATCH finds a match and onMiss.action is "END_STEP_GROUP" and the step is inside a step group
- **THEN** the current step group loop ends and execution continues to the step after the group

#### Scenario: CLICK always proceeds to next ordered step
- **WHEN** a CLICK step finishes execution
- **THEN** execution continues to the next step in order, regardless of any transition configuration

### Requirement: Screenshot control
Each IMAGE_MATCH or IMAGE_GROUP step SHALL have a `realtimeMatch` boolean field. When true, the step captures a fresh screenshot before matching. When false (default), the step reuses the last captured screenshot.

#### Scenario: Realtime match enabled
- **WHEN** an IMAGE_MATCH step has `realtimeMatch=true`
- **THEN** the system captures a fresh browser screenshot before performing template matching

#### Scenario: Realtime match disabled (reuse screenshot)
- **WHEN** an IMAGE_MATCH step has `realtimeMatch=false`
- **THEN** the system reuses the most recently captured screenshot for template matching

### Requirement: Step timeout and task timeout
The system SHALL enforce per-step and per-task timeouts.

#### Scenario: Step timeout triggers onMiss
- **WHEN** a step does not complete within stepTimeoutMs
- **THEN** the step fails and follows its onMiss transition

#### Scenario: Task global timeout stops task
- **WHEN** a task does not complete within globalTimeoutMs
- **THEN** the task stops with status failed

## ADDED Requirements

### Requirement: Coordinate cache integration in task execution
TaskEngine SHALL maintain a coordinate cache (Map<string, {x, y}>) during task execution. IMAGE_MATCH steps with `cacheCoordinates=true` SHALL write to the cache on match and read from it before matching.

#### Scenario: Cache hit during task execution
- **WHEN** an IMAGE_MATCH step with `cacheCoordinates=true` is executed and the cache contains an entry for its template
- **THEN** the step uses cached coordinates without calling the matching service

#### Scenario: Cache miss writes new entry
- **WHEN** an IMAGE_MATCH step with `cacheCoordinates=true` matches successfully and no cache entry exists
- **THEN** the coordinates are stored in the cache keyed by template path

### Requirement: Cache invalidation via resize event
TaskEngine SHALL listen for `browser:resized` IPC events and clear the coordinate cache when received.

#### Scenario: Browser resize clears cache
- **WHEN** the browser window is resized and `browser:resized` event is received
- **THEN** the coordinate cache is cleared entirely

### Requirement: Manual cache clear
TaskEngine SHALL support a `task:clear-coordinate-cache` IPC handler that clears the coordinate cache for a running task.

#### Scenario: Manual cache clear via IPC
- **WHEN** `task:clear-coordinate-cache` is invoked
- **THEN** the coordinate cache for the active task is cleared
