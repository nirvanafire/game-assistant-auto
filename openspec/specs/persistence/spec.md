# Spec: Persistence

## Overview

Dual storage: SQLite for structured data (tasks, steps, network logs, run history), JSON files for task import/export and configuration.

## Requirements

### Functional

1. SQLite database for all structured data
2. JSON import/export for task definitions (shareable between users)
3. Database schema versioning with migrations
4. Automatic database creation on first run
5. Data stored in user data directory (platform-specific)

### Detailed Requirements

#### SQLite storage
The system SHALL use SQLite for all structured data: tasks, steps, step groups, task groups, task group items, task runs, task group runs, and network logs.

#### Schema migrations
The system SHALL support database schema versioning with migrations. Migrations run automatically on app start.

#### JSON import/export
The system SHALL export task definitions and task groups as JSON files. The system SHALL import tasks and task groups from JSON.

#### Storage location
Data SHALL be stored in the platform-specific user data directory.

- **Windows**: %APPDATA%/game-assistant/
- **macOS**: ~/Library/Application Support/game-assistant/

#### WAL mode
SQLite SHALL use WAL mode for concurrent read/write performance.

#### Template image storage
Template images SHALL be stored as files in the templates directory. The database stores file paths only.

### New step columns
The system SHALL include a migration that adds `realtime_match` (boolean, default 0) and `cache_coordinates` (boolean, default 0) columns to the steps table. Existing steps get `realtime_match` from the task's `settings.screenshotBeforeMatch` value and `cache_coordinates` set to 0.

### IPC channels
The system SHALL register `browser:resized` and `task:clear-coordinate-cache` IPC channels for coordinate cache management.

### Storage Locations

```
Windows: %APPDATA%/game-assistant/
macOS:   ~/Library/Application Support/game-assistant/
Linux:   ~/.config/game-assistant/

├── data/
│   ├── game-assistant.db      # SQLite database
│   ├── network-bodies/        # Large response body files
│   └── exports/               # JSON exports
├── templates/                 # User-uploaded template images
└── config.json                # App configuration
```

### JSON Export Format

```json
{
  "version": "1.0",
  "exportedAt": "2025-01-01T00:00:00Z",
  "tasks": [
    {
      "name": "Task A",
      "settings": { ... },
      "interruptHandlers": [ ... ],
      "steps": [ ... ],
      "stepGroups": [ ... ]
    }
  ],
  "taskGroups": [
    {
      "name": "Daily Tasks",
      "failurePolicy": "STOP",
      "retryCount": 0,
      "taskNames": ["Task A", "Task B", "Task A"]
    }
  ]
}
```

Note: Task groups reference tasks by name in the export format. On import, tasks must exist first; group items are resolved by matching task names.

### SQLite Details

- Use WAL mode for concurrent read/write
- Enable foreign keys
- Network logs: auto-prune option (delete entries older than N days)
- Template images: stored as files in templates/, DB stores file path only
