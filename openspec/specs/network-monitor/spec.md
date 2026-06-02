# Spec: Network Monitor

## Overview

Captures all network traffic from the embedded browser using Chrome DevTools Protocol (CDP). Stores request/response data in SQLite with optional file-based storage for large bodies.

## Requirements

### Functional

1. Attach to browser's webContents via CDP debugger
2. Capture HTTP/HTTPS requests: URL, method, status, headers, request body, response body, timing
3. Capture WebSocket connections: frames sent/received
4. Persist all captured data to SQLite
5. Large response bodies (>1MB) stored as files, path recorded in DB
6. Filter and search by URL, method, status code, resource type, time range
7. Export logs as JSON
8. Start/stop monitoring on demand
9. Real-time log streaming to renderer (via IPC)

### Detailed Requirements

#### CDP-based network capture
The system SHALL attach to the embedded browser via Chrome DevTools Protocol and capture all HTTP/HTTPS traffic.

#### HTTP request capture
WHEN the browser makes an HTTP request, THEN the system records URL, method, request headers, request body, timing, and resource type.

#### HTTP response capture
WHEN an HTTP response is received, THEN the system records status code, response headers, response body, and duration.

#### WebSocket capture
The system SHALL capture WebSocket connection events and frame data.

#### Large body handling
Response bodies exceeding 1MB SHALL be stored as files. The database records the file path.

#### Log persistence
All captured network data SHALL be stored in SQLite.

#### Start/stop monitoring
The system SHALL allow starting and stopping network monitoring on demand.

#### Log filtering
The system SHALL support filtering network logs by URL, method, status code, resource type, and time range.

#### Log export
The system SHALL export network logs as JSON.

#### Real-time streaming
Network log entries SHALL be streamed to the renderer in real-time via IPC.

### Non-functional

1. Monitoring must not significantly impact browser performance
2. Storage must handle high-frequency requests (game polling)
3. Old logs should be cleanable (manual or auto-prune after N days)

## CDP Events

```
Network.requestWillBeSent     → request info, headers
Network.responseReceived      → status, response headers
Network.dataReceived          → response body chunks
Network.loadingFinished       → request complete, timing
Network.loadingFailed         → error info
Network.webSocketCreated      → WS connection opened
Network.webSocketFrameSent    → WS outbound frame
Network.webSocketFrameReceived → WS inbound frame
```

## Data Model

```typescript
interface NetworkLog {
  id: number;
  timestamp: Date;
  method: string;
  url: string;
  statusCode: number;
  requestHeaders: Record<string, string>;
  requestBody: string | null;     // null if > 1MB, file path stored
  responseHeaders: Record<string, string>;
  responseBody: string | null;    // null if > 1MB, file path stored
  durationMs: number;
  resourceType: string;           // xhr, fetch, websocket, document, script, image, etc.
  size: number;
  bodyFilePath?: string;          // path to stored body file
}
```

## Implementation Notes

- `session.webRequest` is insufficient (no response bodies); must use CDP
- Attach via `webContents.debugger.attach('1.3')` in Electron
- Enable with `debugger.sendCommand('Network.enable')`
- Listen via `debugger.on('message', handler)`
- Handle debugger detach gracefully (page navigation, crash)
- Binary response bodies (images, etc.) stored as-is; text bodies stored as UTF-8
