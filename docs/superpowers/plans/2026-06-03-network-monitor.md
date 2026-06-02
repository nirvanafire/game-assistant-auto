# Network Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement CDP-based network monitoring with capture, persistence, IPC, and UI.

**Architecture:** NetworkMonitor attaches to webContents via CDP, captures HTTP/WebSocket traffic, persists to SQLite, and streams to renderer via IPC. NetworkLogStore manages renderer-side state.

**Tech Stack:** TypeScript, Electron CDP, SQLite, React, Zustand, Ant Design

---

## Task 1: Network Monitor Service

**Files:**
- Create: `src/main/services/network-monitor.ts`
- Create: `src/main/services/__tests__/network-monitor.test.ts`

- [ ] **Step 1: Write test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkMonitor } from '../network-monitor';

describe('NetworkMonitor', () => {
  let monitor: NetworkMonitor;
  let mockDb: any;
  let mockWebContents: any;
  let mockLogger: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnValue({ run: vi.fn(), all: vi.fn().mockReturnValue([]) }),
    };
    mockWebContents = {
      debugger: {
        attach: vi.fn(),
        detach: vi.fn(),
        sendCommand: vi.fn(),
        on: vi.fn(),
      },
    };
    mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
    monitor = new NetworkMonitor(mockDb, mockWebContents, mockLogger);
  });

  it('starts in stopped state', () => {
    expect(monitor.isCapturing()).toBe(false);
  });

  it('attaches CDP on start', async () => {
    await monitor.start();
    expect(mockWebContents.debugger.attach).toHaveBeenCalledWith('1.3');
    expect(monitor.isCapturing()).toBe(true);
  });

  it('detaches CDP on stop', async () => {
    await monitor.start();
    monitor.stop();
    expect(monitor.isCapturing()).toBe(false);
  });
});
```

- [ ] **Step 2: Implement network-monitor.ts**

```typescript
import type { WebContents } from 'electron';
import type { Logger } from './logger';

interface NetworkLogEntry {
  id?: number;
  timestamp: string;
  method?: string;
  url: string;
  statusCode?: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  durationMs?: number;
  resourceType?: string;
  size?: number;
}

export class NetworkMonitor {
  private db: any;
  private webContents: WebContents;
  private logger: Logger;
  private capturing = false;
  private pendingRequests = new Map<string, any>();

  constructor(db: any, webContents: WebContents, logger: Logger) {
    this.db = db;
    this.webContents = webContents;
    this.logger = logger;
  }

  isCapturing(): boolean {
    return this.capturing;
  }

  async start(): Promise<void> {
    if (this.capturing) return;

    try {
      this.webContents.debugger.attach('1.3');
    } catch (err: any) {
      this.logger.error('Network', `Failed to attach debugger: ${err.message}`);
      return;
    }

    this.webContents.debugger.on('message', (_event: any, method: string, params: any) => {
      this.handleCDPEvent(method, params);
    });

    this.webContents.debugger.on('detach', () => {
      this.capturing = false;
      this.logger.warn('Network', 'Debugger detached');
    });

    await this.webContents.debugger.sendCommand('Network.enable');
    this.capturing = true;
    this.logger.info('Network', 'Network monitoring started');
  }

  stop(): void {
    if (!this.capturing) return;
    try {
      this.webContents.debugger.detach();
    } catch {}
    this.capturing = false;
    this.logger.info('Network', 'Network monitoring stopped');
  }

  getLogs(filters?: { method?: string; url?: string; limit?: number }): NetworkLogEntry[] {
    let sql = 'SELECT * FROM network_logs WHERE 1=1';
    const params: any[] = [];

    if (filters?.method) {
      sql += ' AND method = ?';
      params.push(filters.method);
    }
    if (filters?.url) {
      sql += ' AND url LIKE ?';
      params.push(`%${filters.url}%`);
    }

    sql += ' ORDER BY timestamp DESC';
    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  private handleCDPEvent(method: string, params: any): void {
    switch (method) {
      case 'Network.requestWillBeSent':
        this.onRequestWillBeSent(params);
        break;
      case 'Network.responseReceived':
        this.onResponseReceived(params);
        break;
      case 'Network.loadingFinished':
        this.onLoadingFinished(params);
        break;
    }
  }

  private onRequestWillBeSent(params: any): void {
    const { requestId, request, timestamp } = params;
    this.pendingRequests.set(requestId, {
      timestamp: new Date(timestamp * 1000).toISOString(),
      method: request.method,
      url: request.url,
      requestHeaders: request.headers,
      requestBody: request.postData,
      resourceType: params.type,
    });
  }

  private onResponseReceived(params: any): void {
    const { requestId, response } = params;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    pending.statusCode = response.status;
    pending.responseHeaders = response.headers;
    pending.durationMs = Math.round((response.timing?.receiveHeadersEnd || 0) * 1000);
  }

  private onLoadingFinished(params: any): void {
    const { requestId } = params;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    this.pendingRequests.delete(requestId);

    try {
      this.webContents.debugger.sendCommand('Network.getResponseBody', { requestId }).then((result: any) => {
        const body = result.body;
        const entry = { ...pending, responseBody: body, size: body?.length || 0 };
        this.persistLog(entry);
      }).catch(() => {
        this.persistLog(pending);
      });
    } catch {
      this.persistLog(pending);
    }
  }

  private persistLog(entry: NetworkLogEntry): void {
    try {
      this.db.prepare(
        'INSERT INTO network_logs (timestamp, method, url, status_code, request_headers, request_body, response_headers, response_body, duration_ms, resource_type, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        entry.timestamp, entry.method, entry.url, entry.statusCode,
        JSON.stringify(entry.requestHeaders), entry.requestBody,
        JSON.stringify(entry.responseHeaders), entry.responseBody,
        entry.durationMs, entry.resourceType, entry.size,
      );
    } catch (err: any) {
      this.logger.error('Network', `Failed to persist log: ${err.message}`);
    }
  }
}
```

- [ ] **Step 3: Run tests and commit**

---

## Task 2: Network IPC Handlers

**Files:**
- Create: `src/main/ipc/network.ts`
- Create: `src/main/ipc/__tests__/network-ipc.test.ts`

- [ ] **Step 1: Write test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNetworkIpcHandlers } from '../network';
import { IPC_CHANNELS } from '@shared/constants';

describe('Network IPC Handlers', () => {
  it('registers handlers for network channels', () => {
    const registry = { handle: vi.fn(), getHandler: vi.fn().mockReturnValue(undefined) };
    const monitor = { start: vi.fn(), stop: vi.fn(), isCapturing: vi.fn(), getLogs: vi.fn() };
    createNetworkIpcHandlers(registry as any, monitor as any);
    expect(registry.handle).toHaveBeenCalledWith('network:start', expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith('network:stop', expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith('network:get-logs', expect.any(Function));
  });
});
```

- [ ] **Step 2: Implement network.ts**

```typescript
import type { IpcRegistry } from './registry';
import type { NetworkMonitor } from '../services/network-monitor';

export function createNetworkIpcHandlers(
  registry: IpcRegistry,
  monitor: NetworkMonitor,
): void {
  if (registry.getHandler('network:start')) return;

  registry.handle('network:start', async () => {
    await monitor.start();
    return { success: true };
  });

  registry.handle('network:stop', () => {
    monitor.stop();
    return { success: true };
  });

  registry.handle('network:get-logs', (_event: any, filters?: any) => {
    return { logs: monitor.getLogs(filters) };
  });
}
```

- [ ] **Step 3: Run tests and commit**

---

## Task 3: Network Log Store & UI

**Files:**
- Create: `src/renderer/stores/networkStore.ts`
- Create: `src/renderer/components/Network/NetworkLog.tsx`

- [ ] **Step 1: Create networkStore.ts**

```typescript
import { create } from 'zustand';

interface NetworkLogEntry {
  id?: number;
  timestamp: string;
  method?: string;
  url: string;
  statusCode?: number;
  durationMs?: number;
  resourceType?: string;
  size?: number;
}

interface NetworkState {
  logs: NetworkLogEntry[];
  capturing: boolean;
  methodFilter: string | null;
  urlFilter: string;
  addLog: (entry: NetworkLogEntry) => void;
  clearLogs: () => void;
  setCapturing: (capturing: boolean) => void;
  setMethodFilter: (method: string | null) => void;
  setUrlFilter: (url: string) => void;
  filteredLogs: NetworkLogEntry[];
}

export const useNetworkStore = create<NetworkState>((set) => ({
  logs: [],
  capturing: false,
  methodFilter: null,
  urlFilter: '',
  filteredLogs: [],
  addLog: (entry) => set((state) => {
    const logs = [entry, ...state.logs];
    return { logs, filteredLogs: filterLogs(logs, state) };
  }),
  clearLogs: () => set({ logs: [], filteredLogs: [] }),
  setCapturing: (capturing) => set({ capturing }),
  setMethodFilter: (method) => set((state) => ({ methodFilter: method, filteredLogs: filterLogs(state.logs, { ...state, methodFilter: method }) })),
  setUrlFilter: (url) => set((state) => ({ urlFilter: url, filteredLogs: filterLogs(state.logs, { ...state, urlFilter: url }) })),
}));

function filterLogs(logs: NetworkLogEntry[], state: { methodFilter: string | null; urlFilter: string }): NetworkLogEntry[] {
  return logs.filter((log) => {
    if (state.methodFilter && log.method !== state.methodFilter) return false;
    if (state.urlFilter && !log.url.toLowerCase().includes(state.urlFilter.toLowerCase())) return false;
    return true;
  });
}
```

- [ ] **Step 2: Create NetworkLog.tsx**

```tsx
import React from 'react';
import { Table, Input, Select, Button, Space, Tag } from 'antd';
import { useNetworkStore } from '../../stores/networkStore';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

export const NetworkLog: React.FC = () => {
  const { filteredLogs, capturing, methodFilter, urlFilter, setCapturing, setMethodFilter, setUrlFilter, clearLogs } = useNetworkStore();

  const columns = [
    { title: 'Time', dataIndex: 'timestamp', key: 'timestamp', width: 80, render: (ts: string) => ts.substring(11, 19) },
    { title: 'Method', dataIndex: 'method', key: 'method', width: 80, render: (m: string) => <Tag color={m === 'GET' ? 'green' : 'blue'}>{m}</Tag> },
    { title: 'URL', dataIndex: 'url', key: 'url', ellipsis: true },
    { title: 'Status', dataIndex: 'statusCode', key: 'status', width: 70, render: (s: number) => <Tag color={s < 400 ? 'green' : 'red'}>{s}</Tag> },
    { title: 'Type', dataIndex: 'resourceType', key: 'type', width: 80 },
    { title: 'Size', dataIndex: 'size', key: 'size', width: 70, render: (s: number) => s ? `${(s / 1024).toFixed(1)}K` : '-' },
    { title: 'Duration', dataIndex: 'durationMs', key: 'duration', width: 80, render: (d: number) => d ? `${d}ms` : '-' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Space style={{ padding: 8, flexWrap: 'wrap' }}>
        <Button type={capturing ? 'primary' : 'default'} onClick={() => setCapturing(!capturing)}>
          {capturing ? 'Stop' : 'Start'}
        </Button>
        <Select placeholder="Method" allowClear style={{ width: 100 }} value={methodFilter} onChange={setMethodFilter} options={HTTP_METHODS.map(m => ({ label: m, value: m }))} />
        <Input.Search placeholder="Filter URL" style={{ width: 200 }} value={urlFilter} onChange={e => setUrlFilter(e.target.value)} allowClear />
        <Button onClick={clearLogs}>Clear</Button>
      </Space>
      <Table dataSource={filteredLogs} columns={columns} size="small" pagination={false} scroll={{ y: 'calc(100vh - 300px)' }} rowKey={(_, i) => String(i)} />
    </div>
  );
};
```

- [ ] **Step 3: Commit**

---

## Task 4: Wire into App.tsx

- [ ] **Step 1: Update App.tsx to include NetworkLog component**

Replace the Network tab placeholder in `src/renderer/App.tsx`:

```tsx
{ key: 'network', label: 'Network', children: <NetworkLog /> },
```

Add import:
```tsx
import { NetworkLog } from './components/Network/NetworkLog';
```

- [ ] **Step 2: Commit**
