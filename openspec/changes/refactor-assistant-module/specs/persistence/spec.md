## MODIFIED Requirements

### Requirement: SQLite storage
The system SHALL use SQLite for all structured data including new fields on the steps table for per-step real-time match toggle and coordinate caching settings.

#### Scenario: Steps table has new columns
- **WHEN** the database is migrated to the new schema version
- **THEN** the steps table has `realtime_match` (boolean, default 0) and `cache_coordinates` (boolean, default 0) columns

#### Scenario: Existing steps get default values
- **WHEN** existing steps are migrated
- **THEN** `realtime_match` is set to the task's `settings.screenshotBeforeMatch` value, and `cache_coordinates` is set to 0

## ADDED Requirements

### Requirement: Schema migration for step fields
The system SHALL include a migration that adds `realtime_match` and `cache_coordinates` columns to the steps table.

#### Scenario: Migration runs on app start
- **WHEN** the app starts and the database schema version is behind the current version
- **THEN** the migration adds the new columns with safe defaults before any other operations

#### Scenario: Migration preserves existing data
- **WHEN** the migration runs on an existing database with steps
- **THEN** all existing step data is preserved; new columns are populated with defaults

### Requirement: IPC channel for browser resize
The system SHALL register a `browser:resized` IPC channel that forwards resize events from the renderer to the main process.

#### Scenario: Renderer sends resize event
- **WHEN** the BrowserPanel detects a webview resize
- **THEN** the renderer sends `browser:resized` via IPC and the main process receives it

### Requirement: IPC channel for cache clear
The system SHALL register a `task:clear-coordinate-cache` IPC handler.

#### Scenario: Cache clear IPC invoked
- **WHEN** the renderer invokes `task:clear-coordinate-cache`
- **THEN** the main process clears the coordinate cache for the running task
