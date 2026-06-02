## ADDED Requirements

### Requirement: CDP-based network capture
The system SHALL attach to the embedded browser via Chrome DevTools Protocol and capture all HTTP/HTTPS traffic.

#### Scenario: Capture HTTP request
- **WHEN** the browser makes an HTTP request
- **THEN** the system records URL, method, request headers, request body, timing, and resource type

#### Scenario: Capture HTTP response
- **WHEN** an HTTP response is received
- **THEN** the system records status code, response headers, response body, and duration

### Requirement: WebSocket capture
The system SHALL capture WebSocket connection events and frame data.

#### Scenario: WebSocket frames
- **WHEN** a WebSocket frame is sent or received
- **THEN** the system records the frame data with timestamp

### Requirement: Large body handling
Response bodies exceeding 1MB SHALL be stored as files. The database records the file path.

#### Scenario: Large response
- **WHEN** a response body is 5MB
- **THEN** the body is saved to a file and the database stores the file path

### Requirement: Log persistence
All captured network data SHALL be stored in SQLite.

#### Scenario: Persist request
- **WHEN** a network request completes
- **THEN** a record is inserted into the network_logs table

### Requirement: Start/stop monitoring
The system SHALL allow starting and stopping network monitoring on demand.

#### Scenario: Stop monitoring
- **WHEN** user stops monitoring
- **THEN** CDP Network events are no longer captured

### Requirement: Log filtering
The system SHALL support filtering network logs by URL, method, status code, resource type, and time range.

#### Scenario: Filter by method
- **WHEN** user filters by method=POST
- **THEN** only POST requests are displayed

### Requirement: Log export
The system SHALL export network logs as JSON.

#### Scenario: Export logs
- **WHEN** user clicks export
- **THEN** a JSON file is generated with all matching log entries

### Requirement: Real-time streaming
Network log entries SHALL be streamed to the renderer in real-time via IPC.

#### Scenario: Live update
- **WHEN** a new request is captured
- **THEN** the log viewer updates immediately without refresh
