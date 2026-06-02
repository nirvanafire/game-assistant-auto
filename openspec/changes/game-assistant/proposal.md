## Why

Canvas-based web games render to a bitmap and expose no inspectable DOM elements. Automation requires a visual approach: capture browser content, match against template images, extract coordinates, and simulate mouse clicks. No existing tool combines embedded browser, multi-scale image matching, and configurable task workflows in a single desktop application.

## What Changes

- New desktop application with embedded Chromium browser for loading game web pages
- Screenshot-based image matching via Python + OpenCV service (multi-scale, DPI/resize compatible)
- Configurable task system with branching logic (match/miss → next step or end task)
- Step groups with loop counts within a task
- Task groups for serializing multiple named tasks (same task can appear multiple times)
- Interrupt handlers for popups/loading screens (detected via image matching)
- Network request monitoring with full capture (headers, bodies, timing, WebSocket)
- System logging with file persistence, debug mode toggle, auto-rotation (day/10MB), auto-cleanup (30 days)
- SQLite + JSON persistence for tasks, groups, network logs, and execution history
- Cross-platform packaging: Windows .exe, macOS .dmg
- Automated CI/CD via GitHub Actions

## Capabilities

### New Capabilities
- `image-matching`: Template matching with multi-scale support for locating images within browser screenshots
- `task-engine`: Task execution state machine with steps, step groups, branching, interrupts, and task groups
- `network-monitor`: CDP-based network traffic capture with full request/response logging
- `persistence`: SQLite database and JSON file storage for all application data
- `logging`: System-wide logging with file persistence, debug toggle, and auto-rotation

### Modified Capabilities
(none - new project)

## Impact

- New Electron + TypeScript project with React frontend
- New Python subprocess for image matching (opencv-python-headless, flask, numpy)
- SQLite database (better-sqlite3) for structured data
- CDP debugger attachment on embedded browser for network monitoring
- GitHub Actions workflows for cross-platform CI/CD
- Native module packaging: PyInstaller for Python, electron-builder for Electron

## Non-goals

- External browser attachment (only embedded browser)
- Mobile platform support
- Multi-window/multi-monitor targeting
- Anti-bot evasion beyond basic automation
