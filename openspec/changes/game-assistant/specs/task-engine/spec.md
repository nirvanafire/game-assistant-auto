## ADDED Requirements

### Requirement: Task lifecycle
The system SHALL manage task execution with states: idle, running, paused, completed, failed, stopped.

#### Scenario: Start task
- **WHEN** a task with valid steps is started
- **THEN** status changes to running and execution begins from the first step

#### Scenario: Stop task
- **WHEN** user stops a running task
- **THEN** status changes to stopped and execution halts immediately

### Requirement: Step types
The system SHALL support three step types: IMAGE_MATCH, IMAGE_GROUP, and CLICK.

#### Scenario: IMAGE_MATCH step
- **WHEN** an IMAGE_MATCH step executes
- **THEN** the system captures a screenshot, matches the template, and stores the result

#### Scenario: CLICK step
- **WHEN** a CLICK step executes
- **THEN** the system simulates a mouse click at the specified coordinates

### Requirement: Step branching
Each step SHALL have onMatch and onMiss transitions that specify the next step or end the task.

#### Scenario: Match leads to next step
- **WHEN** an IMAGE_MATCH step finds a match and onMatch.nextStepId is set
- **THEN** execution continues to the specified next step

#### Scenario: Miss ends task
- **WHEN** an IMAGE_MATCH step finds no match and onMiss.action is "END_TASK"
- **THEN** the task completes with status completed

### Requirement: Step groups
The system SHALL support grouping steps with a loop count (0 = infinite).

#### Scenario: Step group with loop
- **WHEN** a step group has loopCount=3
- **THEN** the steps in the group execute 3 times before continuing

#### Scenario: Infinite loop
- **WHEN** a step group has loopCount=0
- **THEN** the steps repeat until the task is manually stopped

### Requirement: Variable capture
The system SHALL store image match results in a task-scoped variable map. CLICK steps SHALL reference coordinates from a previous step.

#### Scenario: Click uses captured coordinates
- **WHEN** step 1 (IMAGE_MATCH) finds a match at (100, 200)
- **AND** step 2 (CLICK) has source="from_step" and stepId=step1
- **THEN** the click is performed at (100, 200)

### Requirement: Interrupt handlers
The system SHALL scan interrupt handlers before each step. If an interrupt is detected, the handler action executes and the current step retries.

#### Scenario: Interrupt detected
- **WHEN** a popup template matches before step execution
- **THEN** the handler clicks to dismiss the popup and the current step retries

### Requirement: Task groups
The system SHALL support task groups that execute multiple tasks serially. The same task can appear multiple times in a group.

#### Scenario: Serial execution
- **WHEN** a task group contains tasks A, B, C
- **THEN** task A runs first, then B, then C, in order

#### Scenario: Same task repeated
- **WHEN** a task group contains task A, task B, task A
- **THEN** task A runs, then B, then A again

### Requirement: Task group failure policy
Task groups SHALL support failure policies: STOP (terminate group), SKIP (skip failed task), RETRY (retry N times).

#### Scenario: STOP policy
- **WHEN** task B fails and policy is STOP
- **THEN** the task group stops, task C does not execute

#### Scenario: SKIP policy
- **WHEN** task B fails and policy is SKIP
- **THEN** task B is skipped and task C executes

#### Scenario: RETRY policy
- **WHEN** task B fails and policy is RETRY with retryCount=2
- **THEN** task B is retried up to 2 times before marking as failed

### Requirement: State isolation
Task status SHALL remain independent of task group execution. Task group tracks its own execution progress.

#### Scenario: Task status unchanged
- **WHEN** a task runs as part of a task group
- **THEN** the task's status field in the database does not change

### Requirement: Screenshot control
Each step SHALL have an optional screenshotBeforeMatch flag. When false (default), the step reuses the last screenshot.

#### Scenario: Reuse screenshot
- **WHEN** screenshotBeforeMatch is false
- **THEN** the step uses the screenshot from the previous step

#### Scenario: Fresh screenshot
- **WHEN** screenshotBeforeMatch is true
- **THEN** the step captures a new screenshot before matching

### Requirement: Step timeout and task timeout
The system SHALL enforce per-step and per-task timeouts.

#### Scenario: Step timeout
- **WHEN** a step does not complete within stepTimeoutMs
- **THEN** the step fails and follows the onMiss transition

#### Scenario: Task global timeout
- **WHEN** a task does not complete within globalTimeoutMs
- **THEN** the task stops with status failed
