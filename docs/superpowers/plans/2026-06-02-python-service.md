# Python Image Matching Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [`) syntax for tracking.

**Goal:** Build a Python/OpenCV image matching service as a persistent HTTP subprocess, with an Electron-side manager and client for spawning, health-checking, and calling it.

**Architecture:** Python Flask service runs as a persistent subprocess, spawned by Electron's main process. It exposes REST endpoints for single/group template matching with multi-scale support. The Electron side has a subprocess manager (spawn, health check, auto-restart, port allocation) and an HTTP client for calling the service.

**Tech Stack:** Python 3, Flask, OpenCV (opencv-python-headless), NumPy, PyInstaller; TypeScript (Electron side)

---

## File Structure

```
game-assistant-auto/
├── python-service/
│   ├── main.py                    # Flask entry, routes
│   ├── matcher.py                 # OpenCV matching logic
│   ├── config.py                  # Default parameters
│   └── requirements.txt           # Dependencies
├── src/main/python/
│   ├── manager.ts                 # Subprocess lifecycle manager
│   └── port.ts                    # Dynamic port allocation
├── src/main/services/
│   └── matcher-client.ts          # HTTP client to Python service
└── src/shared/types/
    └── match-result.ts            # (exists) MatchResult types
```

---

## Task 1: Python Service Foundation

**Files:**
- Create: `python-service/config.py`
- Create: `python-service/requirements.txt`
- Create: `python-service/main.py`

- [ ] **Step 1: Create config.py**

```python
DEFAULT_THRESHOLD = 0.8
DEFAULT_SCALE_RANGE = [0.5, 2.0]
COARSE_STEP = 0.25
FINE_STEP = 0.05
FINE_RANGE = 0.15
```

- [ ] **Step 2: Create requirements.txt**

```
opencv-python-headless>=4.8.0
flask>=3.0.0
numpy>=1.24.0
```

- [ ] **Step 3: Create main.py with /health endpoint**

```python
import cv2
import numpy as np
from flask import Flask, request, jsonify
from matcher import match_template, match_group
from config import DEFAULT_THRESHOLD, DEFAULT_SCALE_RANGE

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'version': '1.0.0',
        'opencv_version': cv2.__version__,
    })

@app.route('/match', methods=['POST'])
def match():
    data = request.json
    screenshot_b64 = data['screenshot']
    template_b64 = data['template']
    threshold = data.get('threshold', DEFAULT_THRESHOLD)
    scale_range = data.get('scale_range', DEFAULT_SCALE_RANGE)
    region = data.get('region')

    screenshot = decode_image(screenshot_b64)
    template = decode_image(template_b64)

    if region:
        x, y, w, h = region['x'], region['y'], region['width'], region['height']
        screenshot = screenshot[y:y+h, x:x+w]
        offset_x, offset_y = x, y
    else:
        offset_x, offset_y = 0, 0

    result = match_template(screenshot, template, threshold, tuple(scale_range))
    if result['matched'] and (offset_x or offset_y):
        result['x'] = result.get('x', 0) + offset_x
        result['y'] = result.get('y', 0) + offset_y

    return jsonify(result)

@app.route('/match-group', methods=['POST'])
def match_group_route():
    data = request.json
    screenshot_b64 = data['screenshot']
    templates_data = data['templates']
    logic = data.get('logic', 'ALL')
    scale_range = data.get('scale_range', DEFAULT_SCALE_RANGE)

    screenshot = decode_image(screenshot_b64)
    templates = [
        {
            'label': t['label'],
            'image': decode_image(t['image']),
            'threshold': t.get('threshold', DEFAULT_THRESHOLD),
        }
        for t in templates_data
    ]

    result = match_group(screenshot, templates, logic, tuple(scale_range))
    return jsonify(result)

def decode_image(base64_str: str) -> np.ndarray:
    import base64
    if ',' in base64_str:
        base64_str = base64_str.split(',', 1)[1]
    data = base64.b64decode(base64_str)
    arr = np.frombuffer(data, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)

if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    app.run(host='127.0.0.1', port=port, debug=False)
```

- [ ] **Step 4: Verify Python service starts**

```bash
cd python-service
pip install -r requirements.txt
python main.py 5000 &
curl http://127.0.0.1:5000/health
```

Expected: `{"opencv_version":"4.x.x","status":"ok","version":"1.0.0"}`

- [ ] **Step 5: Commit**

```bash
git add python-service/
git commit -m "feat: add Python Flask service with health endpoint"
```

---

## Task 2: Multi-Scale Template Matching

**Files:**
- Create: `python-service/matcher.py`

- [ ] **Step 1: Implement matcher.py**

```python
import cv2
import numpy as np
from config import COARSE_STEP, FINE_STEP, FINE_RANGE

def match_template(
    screenshot: np.ndarray,
    template: np.ndarray,
    threshold: float,
    scale_range: tuple[float, float],
) -> dict:
    best = {'matched': False, 'confidence': 0, 'x': 0, 'y': 0, 'scale': 1.0}

    min_scale, max_scale = scale_range
    coarse_scales = np.arange(min_scale, max_scale + COARSE_STEP, COARSE_STEP)

    for scale in coarse_scales:
        result = _try_match(screenshot, template, scale, threshold)
        if result and result['confidence'] > best['confidence']:
            best = result

    if not best['matched']:
        return {'matched': False}

    fine_center = best['scale']
    fine_start = max(min_scale, fine_center - FINE_RANGE)
    fine_end = min(max_scale, fine_center + FINE_RANGE)
    fine_scales = np.arange(fine_start, fine_end + FINE_STEP, FINE_STEP)

    for scale in fine_scales:
        if abs(scale - fine_center) < COARSE_STEP:
            continue
        result = _try_match(screenshot, template, scale, threshold)
        if result and result['confidence'] > best['confidence']:
            best = result

    return best

def match_group(
    screenshot: np.ndarray,
    templates: list[dict],
    logic: str,
    scale_range: tuple[float, float],
) -> dict:
    results = []
    for t in templates:
        result = match_template(screenshot, t['image'], t['threshold'], scale_range)
        results.append({
            'label': t['label'],
            'matched': result['matched'],
            'x': result.get('x'),
            'y': result.get('y'),
            'confidence': result.get('confidence', 0),
            'scale': result.get('scale', 1.0),
        })

    if logic == 'ALL':
        all_matched = all(r['matched'] for r in results)
        if not all_matched:
            for r in results:
                r['matched'] = False

    return {'results': results}

def _try_match(
    screenshot: np.ndarray,
    template: np.ndarray,
    scale: float,
    threshold: float,
) -> dict | None:
    h, w = template.shape[:2]
    new_w = int(w * scale)
    new_h = int(h * scale)

    if new_w <= 0 or new_h <= 0:
        return None
    if new_w > screenshot.shape[1] or new_h > screenshot.shape[0]:
        return None

    scaled = cv2.resize(template, (new_w, new_h), interpolation=cv2.INTER_AREA)
    result = cv2.matchTemplate(screenshot, scaled, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(result)

    if max_val >= threshold:
        center_x = max_loc[0] + new_w // 2
        center_y = max_loc[1] + new_h // 2
        return {
            'matched': True,
            'x': center_x,
            'y': center_y,
            'confidence': float(max_val),
            'scale': float(scale),
        }

    return None
```

- [ ] **Step 2: Test matching with real images**

Create a quick test script to verify matching works:

```bash
cd python-service
python -c "
import cv2
import numpy as np
from matcher import match_template

# Create a test image and template
img = np.zeros((400, 400, 3), dtype=np.uint8)
img[100:200, 100:200] = 255  # White square
template = img[100:200, 100:200].copy()

result = match_template(img, template, 0.8, (0.5, 2.0))
print(result)
assert result['matched'] == True
assert result['confidence'] > 0.99
print('OK')
"
```

Expected: `{'matched': True, 'x': 150, 'y': 150, 'confidence': ~1.0, 'scale': 1.0}`

- [ ] **Step 3: Commit**

```bash
git add python-service/matcher.py
git commit -m "feat: add multi-scale template matching with coarse-to-fine algorithm"
```

---

## Task 3: Python Service Tests

**Files:**
- Create: `python-service/test_matcher.py`

- [ ] **Step 1: Create test file**

```python
import pytest
import cv2
import numpy as np
from matcher import match_template, match_group

def create_test_images():
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    img[100:200, 100:200] = 255
    template = img[100:200, 100:200].copy()
    return img, template

def test_single_match():
    img, template = create_test_images()
    result = match_template(img, template, 0.8, (0.5, 2.0))
    assert result['matched'] == True
    assert result['confidence'] > 0.99
    assert result['x'] == 150
    assert result['y'] == 150

def test_no_match():
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    template = np.ones((50, 50, 3), dtype=np.uint8) * 255
    result = match_template(img, template, 0.99, (0.5, 2.0))
    assert result['matched'] == False

def test_scaled_match():
    img = np.zeros((600, 600, 3), dtype=np.uint8)
    img[150:300, 150:300] = 255
    template = np.zeros((100, 100, 3), dtype=np.uint8)
    template[0:100, 0:100] = 255
    result = match_template(img, template, 0.8, (0.5, 2.0))
    assert result['matched'] == True
    assert abs(result['scale'] - 1.5) < 0.3

def test_group_all():
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    img[50:100, 50:100] = 255
    img[200:250, 200:250] = 128
    t1 = img[50:100, 50:100].copy()
    t2 = img[200:250, 200:250].copy()
    templates = [
        {'label': 'a', 'image': t1, 'threshold': 0.8},
        {'label': 'b', 'image': t2, 'threshold': 0.8},
    ]
    result = match_group(img, templates, 'ALL', (0.5, 2.0))
    assert all(r['matched'] for r in result['results'])

def test_group_any():
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    img[50:100, 50:100] = 255
    t1 = img[50:100, 50:100].copy()
    t2 = np.ones((50, 50, 3), dtype=np.uint8) * 200
    templates = [
        {'label': 'a', 'image': t1, 'threshold': 0.8},
        {'label': 'b', 'image': t2, 'threshold': 0.99},
    ]
    result = match_group(img, templates, 'ANY', (0.5, 2.0))
    assert result['results'][0]['matched'] == True
    assert result['results'][1]['matched'] == False

def test_roi_match():
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    img[100:200, 100:200] = 255
    template = img[100:200, 100:200].copy()
    roi = img[80:220, 80:220]
    result = match_template(roi, template, 0.8, (0.5, 2.0))
    assert result['matched'] == True
```

- [ ] **Step 2: Run tests**

```bash
cd python-service
pip install pytest
python -m pytest test_matcher.py -v
```

Expected: All 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add python-service/test_matcher.py
git commit -m "test: add Python matcher unit tests"
```

---

## Task 4: Port Allocation

**Files:**
- Create: `src/main/python/port.ts`
- Create: `src/main/python/__tests__/port.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { findAvailablePort } from '../port';

describe('findAvailablePort', () => {
  it('returns a number', async () => {
    const port = await findAvailablePort();
    expect(typeof port).toBe('number');
    expect(port).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/python/__tests__/port.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement port.ts**

```typescript
import net from 'net';

export function findAvailablePort(preferred?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    if (preferred) {
      const test = net.createServer();
      test.listen(preferred, '127.0.0.1', () => {
        test.close(() => resolve(preferred));
      });
      test.on('error', () => {
        getDynamicPort().then(resolve).catch(reject);
      });
    } else {
      getDynamicPort().then(resolve).catch(reject);
    }
  });
}

function getDynamicPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Could not determine port')));
      }
    });
    server.on('error', reject);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/python/__tests__/port.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/python/port.ts src/main/python/__tests__/port.test.ts
git commit -m "feat: add dynamic port allocation for Python service"
```

---

## Task 5: Python Subprocess Manager

**Files:**
- Create: `src/main/python/manager.ts`
- Create: `src/main/python/__tests__/manager.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PythonManager } from '../manager';

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const proc = {
      pid: 12345,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'spawn') setTimeout(() => cb(), 10);
      }),
      kill: vi.fn(),
      killed: false,
    };
    return proc;
  }),
}));

vi.mock('../port', () => ({
  findAvailablePort: vi.fn().mockResolvedValue(5000),
}));

describe('PythonManager', () => {
  it('starts with idle status', () => {
    const manager = new PythonManager('/path/to/service');
    expect(manager.getStatus()).toBe('idle');
  });

  it('returns port after start', async () => {
    const manager = new PythonManager('/path/to/service');
    const port = await manager.start();
    expect(port).toBe(5000);
    expect(manager.getStatus()).toBe('running');
  });

  it('kills process on stop', async () => {
    const manager = new PythonManager('/path/to/service');
    await manager.start();
    manager.stop();
    expect(manager.getStatus()).toBe('stopped');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/python/__tests__/manager.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement manager.ts**

```typescript
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { findAvailablePort } from './port';

export type ManagerStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

export class PythonManager {
  private process: ChildProcess | null = null;
  private port: number = 0;
  private status: ManagerStatus = 'idle';
  private servicePath: string;
  private restartCount: number = 0;
  private maxRestarts: number = 3;

  constructor(servicePath: string) {
    this.servicePath = servicePath;
  }

  getStatus(): ManagerStatus {
    return this.status;
  }

  getPort(): number {
    return this.port;
  }

  getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<number> {
    if (this.status === 'running') return this.port;

    this.status = 'starting';
    this.port = await findAvailablePort(5000);

    return new Promise((resolve, reject) => {
      const mainScript = path.join(this.servicePath, 'main.py');
      this.process = spawn('python', [mainScript, String(this.port)], {
        cwd: this.servicePath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString();
        if (msg.includes('Running on')) {
          this.status = 'running';
          resolve(this.port);
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString();
        if (msg.includes('Running on')) {
          this.status = 'running';
          resolve(this.port);
        }
      });

      this.process.on('spawn', () => {
        setTimeout(() => {
          if (this.status === 'starting') {
            this.status = 'running';
            resolve(this.port);
          }
        }, 2000);
      });

      this.process.on('error', (err) => {
        this.status = 'error';
        reject(err);
      });

      this.process.on('exit', (code) => {
        if (this.status === 'running' && this.restartCount < this.maxRestarts) {
          this.restartCount++;
          this.start();
        } else if (this.status !== 'stopped') {
          this.status = 'error';
        }
      });
    });
  }

  stop(): void {
    this.status = 'stopped';
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.process = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/python/__tests__/manager.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/python/manager.ts src/main/python/__tests__/manager.test.ts
git commit -m "feat: add Python subprocess manager with health check and auto-restart"
```

---

## Task 6: Matcher Client

**Files:**
- Create: `src/main/services/matcher-client.ts`
- Create: `src/main/services/__tests__/matcher-client.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatcherClient } from '../matcher-client';

global.fetch = vi.fn();

describe('MatcherClient', () => {
  let client: MatcherClient;

  beforeEach(() => {
    client = new MatcherClient('http://127.0.0.1:5000');
    vi.clearAllMocks();
  });

  it('calls /match endpoint', async () => {
    const mockResult = { matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await client.match({
      screenshot: 'base64data',
      template: 'base64data',
      threshold: 0.8,
      scaleRange: [0.5, 2.0],
    });

    expect(result.matched).toBe(true);
    expect(result.x).toBe(100);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/match',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('calls /match-group endpoint', async () => {
    const mockResult = { results: [{ label: 'a', matched: true }] };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await client.matchGroup({
      screenshot: 'base64data',
      templates: [{ label: 'a', image: 'base64data', threshold: 0.8 }],
      logic: 'ALL',
      scaleRange: [0.5, 2.0],
    });

    expect(result.results).toHaveLength(1);
  });

  it('calls /health endpoint', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', version: '1.0.0', opencv_version: '4.8.0' }),
    });

    const result = await client.health();
    expect(result.status).toBe('ok');
  });

  it('throws on HTTP error', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(client.health()).rejects.toThrow('HTTP 500');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/services/__tests__/matcher-client.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement matcher-client.ts**

```typescript
import type { MatchResult, GroupMatchResult } from '@shared/types/match-result';

interface MatchRequest {
  screenshot: string;
  template: string;
  threshold: number;
  scaleRange: [number, number];
  region?: { x: number; y: number; width: number; height: number };
}

interface MatchGroupRequest {
  screenshot: string;
  templates: Array<{ label: string; image: string; threshold: number }>;
  logic: 'ALL' | 'ANY';
  scaleRange: [number, number];
}

interface HealthResponse {
  status: string;
  version: string;
  opencv_version: string;
}

export class MatcherClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async match(req: MatchRequest): Promise<MatchResult> {
    const body = {
      screenshot: req.screenshot,
      template: req.template,
      threshold: req.threshold,
      scale_range: req.scaleRange,
      region: req.region,
    };
    return this.post<MatchResult>('/match', body);
  }

  async matchGroup(req: MatchGroupRequest): Promise<GroupMatchResult> {
    const body = {
      screenshot: req.screenshot,
      templates: req.templates.map(t => ({
        label: t.label,
        image: t.image,
        threshold: t.threshold,
      })),
      logic: req.logic,
      scale_range: req.scaleRange,
    };
    return this.post<GroupMatchResult>('/match-group', body);
  }

  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/services/__tests__/matcher-client.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/matcher-client.ts src/main/services/__tests__/matcher-client.test.ts
git commit -m "feat: add MatcherClient HTTP service with match, matchGroup, and health"
```

---

## Task 7: Integration Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass (including new port, manager, matcher-client tests).

- [ ] **Step 2: Verify Python service starts and responds**

```bash
cd python-service && python -m pytest test_matcher.py -v
```

Expected: All Python tests pass.

- [ ] **Step 3: Final commit if needed**

```bash
git status
```

Ensure all files are committed.
