## ADDED Requirements

### Requirement: SQLite storage
The system SHALL use SQLite for all structured data: tasks, steps, step groups, task groups, task group items, task runs, task group runs, and network logs.

#### Scenario: Database creation
- **WHEN** the app starts for the first time
- **THEN** the SQLite database is created with all required tables

### Requirement: Schema migrations
The system SHALL support database schema versioning with migrations.

#### Scenario: Schema upgrade
- **WHEN** the app starts with an older database schema
- **THEN** migrations run automatically to bring the schema to the current version

### Requirement: JSON import/export
The system SHALL export task definitions and task groups as JSON files. The system SHALL import tasks and task groups from JSON.

#### Scenario: Export tasks
- **WHEN** user exports tasks
- **THEN** a JSON file is generated with task definitions, steps, step groups, and task groups

#### Scenario: Import tasks
- **WHEN** user imports a JSON file
- **THEN** tasks and task groups are created from the file content

### Requirement: Storage location
Data SHALL be stored in the platform-specific user data directory.

#### Scenario: Windows storage
- **WHEN** running on Windows
- **THEN** data is stored in %APPDATA%/game-assistant/

#### Scenario: macOS storage
- **WHEN** running on macOS
- **THEN** data is stored in ~/Library/Application Support/game-assistant/

### Requirement: WAL mode
SQLite SHALL use WAL mode for concurrent read/write performance.

#### Scenario: Concurrent access
- **WHEN** multiple operations access the database simultaneously
- **THEN** reads and writes do not block each other

### Requirement: Template image storage
Template images SHALL be stored as files in the templates directory. The database stores file paths only.

#### Scenario: Save template
- **WHEN** a user uploads a template image
- **THEN** the file is saved to templates/ and the step config stores the file path
