# Tools & Network Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement image compare tool, click test tool, network log export, and task JSON import/export.

**Architecture:** ImageCompareTool lets users upload two images and test matching via the Python service. ClickTestTool lets users enter coordinates and simulate clicks. Network log export writes filtered logs to JSON. Task import/export serializes tasks with steps to/from JSON files.

**Tech Stack:** TypeScript, React, Ant Design, Electron IPC, better-sqlite3

---

## Task 1: Image Compare Tool

**Files:**
- Create: `src/renderer/components/Tools/ImageCompare.tsx`

- [ ] **Step 1: Implement ImageCompare.tsx**

```tsx
import React, { useState } from 'react';
import { Card, Upload, Button, Space, Typography, Image, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants';

const { Text } = Typography;

interface MatchResult {
  matched: boolean;
  x?: number;
  y?: number;
  confidence?: number;
  scale?: number;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ImageCompare: React.FC = () => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMatch = async () => {
    if (!screenshot || !template) {
      message.warning('Please upload both images first.');
      return;
    }
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      const res = await api.invoke(IPC_CHANNELS.CAPTURE_SCREENSHOT, {
        action: 'match',
        screenshot,
        template,
        threshold: 0.8,
      });
      setResult(res);
    } catch (err) {
      message.error('Match failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space>
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={async (file) => {
            const b64 = await fileToBase64(file);
            setScreenshot(b64);
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>Screenshot</Button>
        </Upload>
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={async (file) => {
            const b64 = await fileToBase64(file);
            setTemplate(b64);
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>Template</Button>
        </Upload>
        <Button type="primary" onClick={handleMatch} loading={loading} disabled={!screenshot || !template}>
          Match
        </Button>
      </Space>

      <Space>
        {screenshot && <Image src={screenshot} width={200} />}
        {template && <Image src={template} width={100} />}
      </Space>

      {result && (
        <Card size="small">
          <Text>Matched: {result.matched ? 'YES' : 'NO'}</Text>
          {result.matched && (
            <Space direction="vertical">
              <Text>X: {result.x}, Y: {result.y}</Text>
              <Text>Confidence: {result.confidence?.toFixed(3)}</Text>
              <Text>Scale: {result.scale?.toFixed(2)}</Text>
            </Space>
          )}
        </Card>
      )}
    </Space>
  );
};
```

- [ ] **Step 2: Commit**

---

## Task 2: Click Test Tool

**Files:**
- Create: `src/renderer/components/Tools/ClickTest.tsx`

- [ ] **Step 1: Implement ClickTest.tsx**

```tsx
import React, { useState } from 'react';
import { Card, Form, InputNumber, Button, Space, Select, message } from 'antd';
import { IPC_CHANNELS } from '@shared/constants';

export const ClickTest: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleClick = async (values: { x: number; y: number; button: string; count: number }) => {
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      await api.invoke(IPC_CHANNELS.CAPTURE_CLICK, {
        x: values.x,
        y: values.y,
        button: values.button,
        count: values.count,
      });
      message.success(`Clicked at (${values.x}, ${values.y})`);
    } catch (err) {
      message.error('Click failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Click Test" size="small">
      <Form layout="inline" onFinish={handleClick} initialValues={{ x: 0, y: 0, button: 'left', count: 1 }}>
        <Form.Item name="x" label="X" rules={[{ required: true }]}>
          <InputNumber />
        </Form.Item>
        <Form.Item name="y" label="Y" rules={[{ required: true }]}>
          <InputNumber />
        </Form.Item>
        <Form.Item name="button" label="Button">
          <Select options={[{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }]} />
        </Form.Item>
        <Form.Item name="count" label="Count">
          <InputNumber min={1} max={10} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>Click</Button>
        </Form.Item>
      </Form>
    </Card>
  );
};
```

- [ ] **Step 2: Commit**

---

## Task 3: Wire Tools into App.tsx

- [ ] **Step 1: Update App.tsx**

Replace the placeholder content in the Tools tab:

```tsx
import { ImageCompare } from './components/Tools/ImageCompare';
import { ClickTest } from './components/Tools/ClickTest';

// Replace the Tools tab items:
{ key: 'compare', label: 'Image Compare', children: <ImageCompare /> },
{ key: 'click', label: 'Click Test', children: <ClickTest /> },
```

- [ ] **Step 2: Commit**

---

## Task 4: Network Log Export

**Files:**
- Modify: `src/main/ipc/network.ts`
- Modify: `src/main/services/network-monitor.ts`

- [ ] **Step 1: Add export method to NetworkMonitor**

Add to `src/main/services/network-monitor.ts`:

```typescript
exportLogs(filters?: { method?: string; url?: string; statusCode?: number }): string {
  const logs = this.getLogs(filters);
  return JSON.stringify(logs, null, 2);
}
```

- [ ] **Step 2: Add export IPC handler**

Add to `src/main/ipc/network.ts`:

```typescript
registry.handle('network:export', (_event: any, filters?: any) => {
  const json = monitor.exportLogs(filters);
  return { json };
});
```

- [ ] **Step 3: Add export button to NetworkLog UI**

Update `src/renderer/components/Network/NetworkLog.tsx` to add an Export button that calls the IPC handler and triggers a file download.

- [ ] **Step 4: Commit**

---

## Task 5: Task JSON Import/Export

**Files:**
- Create: `src/main/ipc/import-export.ts`
- Create: `src/main/ipc/__tests__/import-export.test.ts`

- [ ] **Step 1: Write test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createImportExportHandlers } from '../import-export';
import { IPC_CHANNELS } from '@shared/constants';

describe('Import/Export IPC Handlers', () => {
  let registry: any;
  let mockStorage: any;

  beforeEach(() => {
    registry = { handle: vi.fn(), getHandler: vi.fn().mockReturnValue(undefined) };
    mockStorage = {
      getTask: vi.fn().mockReturnValue({ id: 't1', name: 'Test', status: 'idle', settings: {}, interruptHandlers: [] }),
      listSteps: vi.fn().mockReturnValue([]),
      listTaskGroups: vi.fn().mockReturnValue([]),
      listTaskGroupItems: vi.fn().mockReturnValue([]),
      createTask: vi.fn().mockReturnValue({ id: 't1' }),
      createStep: vi.fn(),
      createTaskGroup: vi.fn().mockReturnValue({ id: 'g1' }),
      addTaskGroupItem: vi.fn(),
    };
  });

  it('registers export and import handlers', () => {
    createImportExportHandlers(registry, mockStorage);
    expect(registry.handle).toHaveBeenCalledWith('import-export:export', expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith('import-export:import', expect.any(Function));
  });

  it('exports tasks as JSON', () => {
    createImportExportHandlers(registry, mockStorage);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === 'import-export:export')[1];
    const result = handler({}, { taskIds: ['t1'] });
    expect(result.data.tasks).toHaveLength(1);
    expect(result.data.tasks[0].name).toBe('Test');
  });
});
```

- [ ] **Step 2: Implement import-export.ts**

```typescript
import type { IpcRegistry } from './registry';
import type { StorageService } from '../services/storage';

export function createImportExportHandlers(
  registry: IpcRegistry,
  storage: StorageService,
): void {
  if (registry.getHandler('import-export:export')) return;

  registry.handle('import-export:export', (_event: any, data: { taskIds?: string[]; groupIds?: string[] }) => {
    const tasks = (data.taskIds || []).map(id => {
      const task = storage.getTask(id);
      if (!task) return null;
      const steps = storage.listSteps(id);
      return { ...task, steps };
    }).filter(Boolean);

    const groups = (data.groupIds || []).map(id => {
      const group = storage.getTaskGroup(id);
      if (!group) return null;
      const items = storage.listTaskGroupItems(id);
      return { ...group, items };
    }).filter(Boolean);

    return { data: { version: 1, tasks, groups } };
  });

  registry.handle('import-export:import', (_event: any, data: { json: string }) => {
    const parsed = JSON.parse(data.json);
    const taskMap = new Map<string, string>();

    for (const task of parsed.tasks || []) {
      const newTask = storage.createTask({ name: task.name, settings: task.settings, interruptHandlers: task.interruptHandlers });
      taskMap.set(task.id, newTask.id);
      for (const step of task.steps || []) {
        const newStep = { ...step, taskId: newTask.id };
        delete (newStep as any).id;
        storage.createStep(newStep);
      }
    }

    for (const group of parsed.groups || []) {
      const newGroup = storage.createTaskGroup({ name: group.name, failurePolicy: group.failurePolicy });
      for (const item of group.items || []) {
        const newTaskId = taskMap.get(item.taskId);
        if (newTaskId) {
          storage.addTaskGroupItem(newGroup.id, newTaskId, item.order);
        }
      }
    }

    return { success: true };
  });
}
```

- [ ] **Step 3: Run tests and commit**

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
