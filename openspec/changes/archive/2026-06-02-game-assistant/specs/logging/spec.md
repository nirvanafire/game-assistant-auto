## ADDED Requirements

### Requirement: Log levels
The system SHALL support four log levels: ERROR, WARN, INFO, DEBUG.

#### Scenario: Default logging
- **WHEN** debug mode is off
- **THEN** only ERROR, WARN, and INFO logs are recorded

#### Scenario: Debug mode enabled
- **WHEN** debug mode is on
- **THEN** DEBUG logs are also recorded

### Requirement: Global debug toggle
The system SHALL provide a global debug toggle that persists across sessions.

#### Scenario: Toggle debug on
- **WHEN** user enables debug mode in the log viewer
- **THEN** DEBUG logs start appearing in real-time and are written to file

#### Scenario: Toggle persists
- **WHEN** user enables debug mode and restarts the app
- **THEN** debug mode remains enabled

### Requirement: Dual output
Logs SHALL be written to file and sent to the renderer simultaneously.

#### Scenario: Log appears in both places
- **WHEN** an INFO log is generated
- **THEN** it is written to the log file AND displayed in the log viewer UI

### Requirement: File rotation by day
The system SHALL create a new log file when the date changes.

#### Scenario: Date change
- **WHEN** a log is written after midnight
- **THEN** a new file is created with the new date in the filename

### Requirement: File rotation by size
The system SHALL create a new log file when the current file exceeds 10MB.

#### Scenario: Size exceeded
- **WHEN** the current log file reaches 10MB
- **THEN** a new file is created with an incremented N suffix

### Requirement: Log file naming
Log files SHALL follow the pattern `game-assistant-{YYYY-MM-DD}.log`. Overflow files SHALL use `game-assistant-{YYYY-MM-DD}.{N}.log`.

#### Scenario: First file of the day
- **WHEN** the first log of a new day is written
- **THEN** the filename is `game-assistant-2025-01-01.log`

#### Scenario: Overflow file
- **WHEN** the first file exceeds 10MB
- **THEN** the next file is `game-assistant-2025-01-01.1.log`

### Requirement: Auto-cleanup
The system SHALL delete log files older than 30 days on app startup.

#### Scenario: Old files deleted
- **WHEN** the app starts
- **THEN** any log files with dates older than 30 days are deleted

### Requirement: Log format
File logs SHALL use the format: `[timestamp] [LEVEL] [source] message`

#### Scenario: File log entry
- **WHEN** an INFO log is written from TaskEngine
- **THEN** the file line is `[2025-01-01 12:00:01.123] [INFO] [TaskEngine] message`

### Requirement: Log sources
The system SHALL tag logs with their source module: TaskEngine, Matcher, Clicker, Network, Python, Storage, App.

#### Scenario: Source tagging
- **WHEN** the matcher service logs a message
- **THEN** the source is "Matcher"

### Requirement: Log viewer UI
The log viewer SHALL display logs in real-time with filtering by level, source, and text search. It SHALL support clearing the display and exporting logs.

#### Scenario: Filter by level
- **WHEN** user selects ERROR level filter
- **THEN** only ERROR logs are displayed

#### Scenario: Search logs
- **WHEN** user types "timeout" in search
- **THEN** only logs containing "timeout" are displayed

#### Scenario: Export logs
- **WHEN** user clicks export
- **THEN** a file is generated with the currently displayed logs
