## ADDED Requirements

### Requirement: Single template matching
The system SHALL match a single template image against a browser screenshot and return the center coordinates, confidence score, and matched scale.

#### Scenario: Successful match
- **WHEN** a screenshot and template image are provided with threshold 0.8
- **THEN** the system returns `{ matched: true, x, y, confidence, scale }` where confidence >= 0.8

#### Scenario: No match found
- **WHEN** a screenshot and template image are provided with threshold 0.8
- **AND** no region exceeds the threshold at any scale
- **THEN** the system returns `{ matched: false }`

### Requirement: Multi-scale matching
The system SHALL perform template matching across multiple scale factors to handle window resize and OS DPI scaling.

#### Scenario: Match at different scale
- **WHEN** the template was captured at 1.0x but the current browser renders at 1.25x
- **THEN** the system finds the match at scale 1.25 with confidence >= threshold

#### Scenario: Configurable scale range
- **WHEN** scale_range is set to [0.75, 1.5]
- **THEN** the system only scans scales within that range

### Requirement: Coarse-to-fine matching
The system SHALL use a two-pass approach: coarse scan at 0.25 step, then fine refinement at 0.05 step around the best match.

#### Scenario: Coarse then fine
- **WHEN** matching is performed
- **THEN** the system first scans at 0.25 increments, then refines at 0.05 increments around the best coarse match

### Requirement: Group template matching
The system SHALL match multiple templates against a screenshot with ALL or ANY logic.

#### Scenario: ALL logic
- **WHEN** logic is "ALL" and 3 templates are provided
- **THEN** the system returns matched=true for each template only if all 3 are found

#### Scenario: ANY logic
- **WHEN** logic is "ANY" and 3 templates are provided
- **THEN** the system returns matched=true for templates that are found, even if not all match

### Requirement: Region of interest
The system SHALL support an optional region-of-interest (ROI) to limit the search area for faster matching.

#### Scenario: ROI specified
- **WHEN** a region { x, y, width, height } is provided
- **THEN** the system only searches within that region of the screenshot

### Requirement: Health check endpoint
The system SHALL expose a GET /health endpoint returning service status and version information.

#### Scenario: Health check
- **WHEN** GET /health is called
- **THEN** the system returns `{ status: "ok", version, opencv_version }`
