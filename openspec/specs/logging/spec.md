# Spec: Logging System

## Overview

System-wide logging with file persistence, debug mode toggle, auto-rotation by day and size, and auto-cleanup of old logs.

## Requirements

### Functional

1. Log levels: ERROR, WARN, INFO, DEBUG
2. Default: record ERROR, WARN, INFO only
3. Global debug toggle: when enabled, DEBUG level logs are also recorded
4. Log to file and display in UI simultaneously
5. Log file rotation by day: new file when date changes
6. Log file rotation by size: new file when current file exceeds 10MB
7. Auto-cleanup: delete log files older than 30 days
8. Log viewer UI: real-time display, filter by level, filter by source, search, clear, export

### Detailed Requirements

#### Log levels
The system SHALL support four log levels: ERROR, WARN, INFO, DEBUG.

- **Default logging**: debug mode off → only ERROR, WARN, INFO recorded
- **Debug mode enabled**: debug mode on → DEBUG logs also recorded

#### Global debug toggle
The system SHALL provide a global debug toggle that persists across sessions.

- **Toggle debug on**: user enables debug mode → DEBUG logs start appearing in real-time
- **Toggle persists**: user enables debug mode and restarts app → debug mode remains enabled

#### Dual output
Logs SHALL be written to file and sent to the renderer simultaneously.

#### File rotation by day
The system SHALL create a new log file when the date changes.

#### File rotation by size
The system SHALL create a new log file when the current file exceeds 10MB.

#### Log file naming
Log files SHALL follow the pattern `game-assistant-{YYYY-MM-DD}.log`. Overflow files SHALL use `game-assistant-{YYYY-MM-DD}.{N}.log`.

#### Auto-cleanup
The system SHALL delete log files older than 30 days on app startup.

#### Log format
File logs SHALL use the format: `[timestamp] [LEVEL] [source] message`

#### Log sources
The system SHALL tag logs with their source module: TaskEngine, Matcher, Clicker, Network, Python, Storage, App.

#### Log viewer UI
The log viewer SHALL display logs in real-time with filtering by level, source, and text search. It SHALL support clearing the display and exporting logs.

- **Filter by level**: user selects ERROR level → only ERROR logs displayed
- **Search logs**: user types "timeout" → only logs containing "timeout" displayed
- **Export logs**: user clicks export → file generated with currently displayed logs

### Non-functional

1. Logging must not block main thread (async file writes)
2. IPC to renderer must not overwhelm UI (batch or throttle high-frequency DEBUG logs)
3. File I/O errors must not crash the application

## Log Format

### File format

```
[2025-01-01 12:00:01.123] [INFO] [TaskEngine] Task "签到" started
[2025-01-01 12:00:01.150] [DEBUG] [Matcher] scale=1.25 conf=0.92 45ms
[2025-01-01 12:00:02.001] [ERROR] [Python] Connection refused
```

Format: `[timestamp] [LEVEL] [source] message`

### UI format

```
12:00:01  INFO   TaskEngine  Task "签到" started
12:00:01  DEBUG  Matcher     scale=1.25 conf=0.92 45ms
12:00:02  ERROR  Python      Connection refused
```

## File Management

### Storage location

```
{userData}/data/logs/
├── game-assistant-2025-01-01.log
├── game-assistant-2025-01-01.1.log    (overflow after 10MB)
├── game-assistant-2025-01-01.2.log
├── game-assistant-2025-01-02.log
└── ...
```

### Rotation rules

- Check before each write:
  1. If date changed from last write → create new file with new date
  2. If current file size > 10MB → create new file with incremented N suffix
- Filename pattern: `game-assistant-{YYYY-MM-DD}.log`
- Overflow pattern: `game-assistant-{YYYY-MM-DD}.{N}.log`

### Auto-cleanup

- On app startup: scan log files, delete any older than 30 days
- Configurable retention period in app settings

## Sources

| Source | Module |
|---|---|
| `TaskEngine` | Task execution engine |
| `Matcher` | Image matching (Python service calls) |
| `Clicker` | Simulated clicks |
| `Network` | Network monitor / CDP |
| `Python` | Python subprocess lifecycle |
| `Storage` | Database / file persistence |
| `App` | General application events |

## Debug Toggle

- Global switch in the log viewer UI
- Stored in config.json (persists across sessions)
- When OFF: DEBUG logs are discarded before writing to file or sending to UI
- When ON: DEBUG logs are written to file and sent to UI

## IPC

```
Main → Renderer:
  log:entry    { timestamp, level, source, message }
  log:debug-state  { enabled: boolean }

Renderer → Main:
  log:set-debug    { enabled: boolean }
  log:get-logs     { level?, source?, search?, limit?, offset? }
  log:export       { filePath }
  log:clear-display
```
