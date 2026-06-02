# Spec: Image Matching

## Overview

Template matching service that locates a small template image within a browser screenshot. Handles window resize and OS DPI scaling via multi-scale matching.

## Requirements

### Functional

1. Match a single template image against a screenshot at multiple scales
2. Match a group of templates with ALL/ANY logic
3. Return match coordinates (center of matched region), confidence score, and matched scale
4. Support configurable confidence threshold (0-1)
5. Support configurable scale range (default 0.5x to 2.0x)
6. Support optional region-of-interest (ROI) to limit search area
7. Coarse-to-fine matching: scan at 0.25 increments, refine at 0.05 increments around best match
8. Scale cache: remember successful scale per session for faster subsequent matching

### Detailed Requirements

#### Single template matching
The system SHALL match a single template image against a browser screenshot and return the center coordinates, confidence score, and matched scale.

- **Successful match**: screenshot + template with threshold 0.8 → `{ matched: true, x, y, confidence, scale }` where confidence >= 0.8
- **No match found**: no region exceeds threshold at any scale → `{ matched: false }`

#### Multi-scale matching
The system SHALL perform template matching across multiple scale factors to handle window resize and OS DPI scaling.

- **Match at different scale**: template captured at 1.0x, browser renders at 1.25x → finds match at scale 1.25
- **Configurable scale range**: scale_range [0.75, 1.5] → only scans within that range

#### Coarse-to-fine matching
The system SHALL use a two-pass approach: coarse scan at 0.25 step, then fine refinement at 0.05 step around the best match.

#### Group template matching
The system SHALL match multiple templates against a screenshot with ALL or ANY logic.

- **ALL logic**: 3 templates provided → matched=true only if all 3 are found
- **ANY logic**: 3 templates provided → matched=true for templates that are found

#### Region of interest
The system SHALL support an optional region-of-interest (ROI) to limit the search area for faster matching.

- **ROI specified**: region { x, y, width, height } → system only searches within that region

#### Health check endpoint
The system SHALL expose a GET /health endpoint returning service status and version information.

### Non-functional

1. Single match latency < 100ms (1920x1080 screenshot, 100x100 template)
2. Service must handle concurrent requests (multiple tasks running)
3. Graceful degradation: return `{ matched: false }` on failure, never crash
4. Health check endpoint for monitoring

## API

### POST /match

```
Request:
  screenshot: base64 PNG
  template: base64 PNG
  threshold: float (0-1, default 0.8)
  scale_range: [float, float] (default [0.5, 2.0])
  region?: { x: int, y: int, width: int, height: int }

Response:
  { matched: bool, x: int, y: int, confidence: float, scale: float }
```

### POST /match-group

```
Request:
  screenshot: base64 PNG
  templates: [{ label: string, image: base64, threshold: float }]
  logic: "ALL" | "ANY"
  scale_range: [float, float]

Response:
  { results: [{ label: string, matched: bool, x: int, y: int, confidence: float, scale: float }] }
```

### GET /health

```
Response:
  { status: "ok", version: string, opencv_version: string }
```

## Algorithm

1. Convert screenshot and template to grayscale
2. For each scale in coarse range (0.25 step):
   a. Resize template by scale factor
   b. Skip if resized template larger than screenshot
   c. Run cv2.matchTemplate with TM_CCOEFF_NORMED
   d. Track best match above threshold
3. If coarse match found, refine with 0.05 step around best scale
4. Convert top-left coordinates to center coordinates
5. Return result

## Scale Calculation

- Base scale = browser.devicePixelFactor / templateCaptureDPI
- Scan range centered on base scale when known
- Fallback to [0.5, 2.0] when DPI info unavailable

## Error Handling

- Invalid base64 → 400 Bad Request
- Template larger than screenshot at all scales → `{ matched: false }`
- Internal error → 500 with error message, service stays alive
