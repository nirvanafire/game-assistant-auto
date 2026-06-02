# Browser & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement embedded BrowserView, network log file storage, logger integration, Python crash recovery, and app configuration.

**Architecture:** BrowserView embeds Chromium in the app's BrowserWindow. Network large bodies are stored as files. Logger is integrated into all services. PythonManager gains health monitoring during task execution. App configuration is persisted to a JSON file.

**Tech Stack:** TypeScript, Electron (BrowserView, webContents), better-sqlite3, Node.js fs

---

## Task 1: Embedded BrowserView

**Files:**
- Modify: `src/main/window.ts`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Implement BrowserView in window.ts**

Read `src/main/window.ts` first. Then modify it to create a BrowserView attached to the main window.

The BrowserView should:
- Be created and attached to the BrowserWindow on creation
- Load a default URL (about:blank or a local placeholder)
- Be positioned in the left panel (the renderer will communicate the desired bounds via IPC)

```typescript
import { BrowserWindow, BrowserView } from 'electron';

let mainWindow: BrowserWindow | null = null;
let browserView: BrowserView | null = null;

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Create BrowserView for embedded browser
  browserView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setBrowserView(browserView);
  browserView.setBounds({ x: 0, y: 0, width: 600, height: 800 });
  browserView.webContents.loadURL('about:blank');

  // Load the renderer UI
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

export function getBrowserView(): BrowserView | null {
  return browserView;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
```

- [ ] **Step 2: Add browser IPC handlers**

Add to `src/main/index.ts`:

```typescript
import { getBrowserView } from './window';

// Browser navigation handler
registry.handle('browser:load-url', async (_event: any, data: { url: string }) => {
  const view = getBrowserView();
  if (!view) return { success: false };
  await view.webContents.loadURL(data.url);
  return { success: true };
});

registry.handle('browser:get-url', () => {
  const view = getBrowserView();
  return { url: view?.webContents.getURL() || '' };
});

registry.handle('browser:set-bounds', (_event: any, data: { x: number; y: number; width: number; height: number }) => {
  const view = getBrowserView();
  if (!view) return { success: false };
  view.setBounds(data);
  return { success: true };
});
```

- [ ] **Step 3: Add BrowserPanel component to renderer**

Create `src/renderer/components/Browser/BrowserPanel.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { Input, Space, Button, message } from 'antd';
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants';

export const BrowserPanel: React.FC = () => {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    loadCurrentUrl();
  }, []);

  const loadCurrentUrl = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const result = await api.invoke('browser:get-url');
    setCurrentUrl(result?.url || '');
    setUrl(result?.url || '');
  };

  const handleNavigate = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    try {
      let targetUrl = url;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('about:')) {
        targetUrl = 'https://' + targetUrl;
      }
      await api.invoke('browser:load-url', { url: targetUrl });
      setCurrentUrl(targetUrl);
    } catch (err) {
      message.error('Failed to load URL');
    }
  };

  const handleRefresh = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    await api.invoke('browser:load-url', { url: currentUrl });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Space style={{ padding: 8 }}>
        <Input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onPressEnter={handleNavigate}
          placeholder="Enter URL..."
          style={{ width: 400 }}
        />
        <Button type="primary" onClick={handleNavigate}>Go</Button>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh} />
      </Space>
    </div>
  );
};
```

- [ ] **Step 4: Wire BrowserPanel into App.tsx**

Replace the browser placeholder in App.tsx:

```tsx
import { BrowserPanel } from './components/Browser/BrowserPanel';

// Replace the left panel:
<Splitter.Panel defaultSize="50%" min="30%">
  <BrowserPanel />
</Splitter.Panel>
```

- [ ] **Step 5: Commit**

---

## Task 2: Network Log Large Body File Storage

**Files:**
- Modify: `src/main/services/network-monitor.ts`

- [ ] **Step 1: Add file storage for large response bodies**

The spec says response bodies exceeding 1MB should be stored as files, with the file path stored in the DB.

Add to NetworkMonitor:

```typescript
import fs from 'fs';
import path from 'path';

// In persistLog method, add size check:
private persistLog(entry: NetworkLogEntry): void {
  try {
    let responseBody = entry.responseBody;
    let responseBodyPath: string | null = null;

    // Store large bodies (>1MB) as files
    if (responseBody && responseBody.length > 1024 * 1024) {
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
      responseBodyPath = path.join(this.logDir, 'network-bodies', fileName);
      fs.mkdirSync(path.dirname(responseBodyPath), { recursive: true });
      fs.writeFileSync(responseBodyPath, responseBody);
      responseBody = null; // Don't store in DB
    }

    this.db.prepare(
      'INSERT INTO network_logs (timestamp, method, url, status_code, request_headers, request_body, response_headers, response_body, response_body_path, duration_ms, resource_type, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      entry.timestamp, entry.method, entry.url, entry.statusCode,
      JSON.stringify(entry.requestHeaders), entry.requestBody,
      JSON.stringify(entry.responseHeaders), responseBody, responseBodyPath,
      entry.durationMs, entry.resourceType, entry.size,
    );
  } catch (err: any) {
    this.logger.error('Network', `Failed to persist log: ${err.message}`);
  }
}
```

This requires adding a `logDir` parameter to the constructor and a `response_body_path` column to the schema.

- [ ] **Step 2: Add schema migration**

Add to `src/main/db/schema.ts` (or a new migration):

```sql
ALTER TABLE network_logs ADD COLUMN response_body_path TEXT;
```

- [ ] **Step 3: Commit**

---

## Task 3: Logger Integration

**Files:**
- Modify: `src/main/services/matcher-client.ts`
- Modify: `src/main/services/clicker.ts`
- Modify: `src/main/python/manager.ts`

- [ ] **Step 1: Add logger to MatcherClient**

Modify `MatcherClient` constructor to accept an optional `Logger`:

```typescript
import type { Logger } from './logger';

export class MatcherClient {
  private baseUrl: string;
  private logger?: Logger;

  constructor(baseUrl: string, logger?: Logger) {
    this.baseUrl = baseUrl;
    this.logger = logger;
  }

  async match(req: MatchRequest): Promise<MatchResult> {
    this.logger?.debug('Matcher', `Matching template at ${req.template}`);
    // ... existing code
  }

  // Add error logging to the post/get methods
  private async post<T>(path: string, body: unknown): Promise<T> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, { ... });
      if (!res.ok) {
        this.logger?.error('Matcher', `HTTP ${res.status}: ${res.statusText}`);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    } catch (err: any) {
      this.logger?.error('Matcher', `Request failed: ${err.message}`);
      throw err;
    }
  }
}
```

- [ ] **Step 2: Add logger to ClickerService**

```typescript
import type { Logger } from './logger';

export class ClickerService {
  private webContents: WebContents;
  private logger?: Logger;

  constructor(webContents: WebContents, logger?: Logger) {
    this.webContents = webContents;
    this.logger = logger;
  }

  async click(x: number, y: number, options?: ClickOptions): Promise<void> {
    this.logger?.debug('Clicker', `Click at (${x}, ${y}) button=${options?.button ?? 'left'}`);
    // ... existing code
  }
}
```

- [ ] **Step 3: Add logger to PythonManager**

```typescript
import type { Logger } from '../services/logger';

export class PythonManager {
  private logger?: Logger;

  constructor(servicePath: string, logger?: Logger) {
    this.servicePath = servicePath;
    this.logger = logger;
  }

  async start(): Promise<number> {
    this.logger?.info('Python', `Starting Python service on port ${this.port}`);
    // ... existing code
    // Add logging to error/exit handlers
    this.process.on('error', (err) => {
      this.logger?.error('Python', `Process error: ${err.message}`);
      // ... existing code
    });
    this.process.on('exit', (code) => {
      this.logger?.warn('Python', `Process exited with code ${code}`);
      // ... existing code
    });
  }
}
```

- [ ] **Step 4: Update index.ts to pass logger**

Update the service instantiation in `src/main/index.ts` to pass logger to all services.

- [ ] **Step 5: Commit**

---

## Task 4: Python Service Crash Recovery

**Files:**
- Modify: `src/main/services/task-engine.ts`

- [ ] **Step 1: Add health check before task execution**

In `TaskEngine.start()`, check Python service health before executing:

```typescript
async start(taskId: string): Promise<void> {
  const task = this.storage.getTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);

  // Health check before execution
  try {
    const health = await this.matcher.health();
    if (health.status !== 'ok') {
      throw new Error('Python service is not healthy');
    }
  } catch (err: any) {
    this.statuses.set(taskId, 'failed');
    this.logger?.error('TaskEngine', `Python service unavailable: ${err.message}`);
    return;
  }

  // ... rest of existing code
}
```

- [ ] **Step 2: Add retry on match failure**

In `executeStepInner` for IMAGE_MATCH, add retry logic when the matcher request fails (not when the template doesn't match):

```typescript
case 'IMAGE_MATCH': {
  const config = step.config as any;
  let result: MatchResult;
  try {
    result = await this.matcher.match({
      screenshot: ctx.lastScreenshot!,
      template: config.templatePath,
      threshold: config.threshold,
      scaleRange: config.scaleRange,
      region: config.captureRegion,
    });
  } catch (err: any) {
    this.logger?.warn('TaskEngine', `Match request failed, retrying: ${err.message}`);
    // One retry on network error
    result = await this.matcher.match({
      screenshot: ctx.lastScreenshot!,
      template: config.templatePath,
      threshold: config.threshold,
      scaleRange: config.scaleRange,
      region: config.captureRegion,
    });
  }
  if (result.matched) {
    ctx.variables.set(step.id, result);
  }
  return result.matched;
}
```

- [ ] **Step 3: Commit**

---

## Task 5: App Configuration

**Files:**
- Create: `src/main/services/config.ts`
- Create: `src/main/services/__tests__/config.test.ts`

- [ ] **Step 1: Write test**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '../config';
import fs from 'fs';

vi.mock('fs');

describe('ConfigService', () => {
  let config: ConfigService;
  const configPath = '/test/config.json';

  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    config = new ConfigService(configPath);
  });

  it('returns default values when no config file exists', () => {
    expect(config.get('dataDir')).toBeDefined();
    expect(config.get('autoPruneDays')).toBe(30);
  });

  it('sets and gets values', () => {
    config.set('autoPruneDays', 60);
    expect(config.get('autoPruneDays')).toBe(60);
  });

  it('persists to file on set', () => {
    config.set('autoPruneDays', 60);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('loads existing config file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ autoPruneDays: 14 }));
    const c = new ConfigService(configPath);
    expect(c.get('autoPruneDays')).toBe(14);
  });
});
```

- [ ] **Step 2: Implement config.ts**

```typescript
import fs from 'fs';

interface AppConfig {
  dataDir: string;
  autoPruneDays: number;
  pythonPort: number;
  debugMode: boolean;
}

const DEFAULTS: AppConfig = {
  dataDir: '',
  autoPruneDays: 30,
  pythonPort: 5000,
  debugMode: false,
};

export class ConfigService {
  private config: AppConfig;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.config = { ...DEFAULTS };
    this.load();
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.save();
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        this.config = { ...DEFAULTS, ...data };
      }
    } catch {
      this.config = { ...DEFAULTS };
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2));
    } catch {}
  }
}
```

- [ ] **Step 3: Wire into index.ts**

```typescript
import { ConfigService } from './services/config';

const configPath = path.join(userDataPath, 'data', 'config.json');
const config = new ConfigService(configPath);

// Use config values:
const logDir = path.join(userDataPath, 'data', 'logs');
const matcher = new MatcherClient(`http://127.0.0.1:${config.get('pythonPort')}`, logger);
```

- [ ] **Step 4: Run tests and commit**

---

## Task 6: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
