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
