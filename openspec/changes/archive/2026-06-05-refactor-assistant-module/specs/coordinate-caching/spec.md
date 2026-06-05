## ADDED Requirements

### Requirement: Coordinate cache write on match success
The system SHALL cache the coordinates returned by a successful IMAGE_MATCH step during task execution. The cache key SHALL be the step's template path.

#### Scenario: First match caches coordinates
- **WHEN** an IMAGE_MATCH step with caching enabled matches successfully at coordinates (100, 200)
- **THEN** the system stores `{ templatePath: "button.png", x: 100, y: 200 }` in the task-scoped coordinate cache

#### Scenario: Match failure does not cache
- **WHEN** an IMAGE_MATCH step with caching enabled fails to match (below threshold)
- **THEN** no entry is written to the coordinate cache

### Requirement: Coordinate cache read on subsequent match
The system SHALL check the coordinate cache before executing an IMAGE_MATCH step. If a cached entry exists for the same template path, the system SHALL use the cached coordinates instead of re-matching.

#### Scenario: Cache hit skips matching
- **WHEN** an IMAGE_MATCH step with caching enabled is executed and the cache contains coordinates for its template path
- **THEN** the step uses the cached coordinates without capturing a screenshot or calling the matching service

#### Scenario: Cache miss proceeds to matching
- **WHEN** an IMAGE_MATCH step with caching enabled is executed and no cache entry exists for its template path
- **THEN** the step proceeds with normal screenshot capture and matching

### Requirement: Coordinate cache provides coordinates to CLICK steps
CLICK steps that reference coordinates from a previous IMAGE_MATCH step SHALL use cached coordinates when available.

#### Scenario: CLICK uses cached coordinates from upstream match
- **WHEN** step 1 (IMAGE_MATCH, caching enabled) matches at (100, 200) and caches the result, and step 2 (CLICK) references step 1's coordinates
- **THEN** step 2 clicks at (100, 200) using the cached coordinates

### Requirement: Cache invalidation on window resize
The system SHALL clear the entire coordinate cache when the browser window is resized.

#### Scenario: Window resize clears cache
- **WHEN** the browser window is resized while a task is running with cached coordinates
- **THEN** all entries in the coordinate cache are cleared

### Requirement: Manual cache clear
The system SHALL provide a mechanism for the user to manually clear the coordinate cache during task execution.

#### Scenario: User clears cache manually
- **WHEN** the user triggers the cache clear action (via IPC or UI button)
- **THEN** all entries in the coordinate cache are cleared

### Requirement: Cache scope is task execution
The coordinate cache SHALL exist only during a single task execution. It SHALL NOT persist across task runs or app restarts.

#### Scenario: New task run starts with empty cache
- **WHEN** a task is started
- **THEN** the coordinate cache is initialized as empty, regardless of previous runs

### Requirement: Cache toggle per step
Each IMAGE_MATCH step SHALL have a boolean `cacheCoordinates` field. When false (default), the step does not read from or write to the cache.

#### Scenario: Caching disabled on step
- **WHEN** an IMAGE_MATCH step has `cacheCoordinates=false`
- **THEN** the step always performs full matching and does not interact with the cache
