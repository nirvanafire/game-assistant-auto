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
