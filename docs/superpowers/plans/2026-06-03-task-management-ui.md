# Task Management & UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement task/taskgroup IPC handlers, task editor UI, step editor UI, and task group editor UI — the core management interface.

**Architecture:** IPC handlers bridge main process services (StorageService, TaskEngine, TaskGroupEngine) to the renderer. Zustand stores manage renderer-side state. Ant Design forms edit task/step/group configurations.

**Tech Stack:** TypeScript, React, Zustand, Ant Design, Electron IPC

---

## Task 1: Task IPC Handlers

**Files:**
- Create: `src/main/ipc/task.ts`
- Create: `src/main/ipc/__tests__/task-ipc.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTaskIpcHandlers } from '../task';
import { IPC_CHANNELS } from '@shared/constants';

describe('Task IPC Handlers', () => {
  let registry: any;
  let mockStorage: any;
  let mockTaskEngine: any;
  let mockWebContents: any;

  beforeEach(() => {
    registry = { handle: vi.fn(), getHandler: vi.fn().mockReturnValue(undefined) };
    mockStorage = {
      createTask: vi.fn().mockReturnValue({ id: 't1', name: 'Test' }),
      getTask: vi.fn().mockReturnValue({ id: 't1', name: 'Test' }),
      listTasks: vi.fn().mockReturnValue([]),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      createStep: vi.fn(),
      listSteps: vi.fn().mockReturnValue([]),
      createStepGroup: vi.fn(),
      listStepGroups: vi.fn().mockReturnValue([]),
    };
    mockTaskEngine = { start: vi.fn(), stop: vi.fn(), getStatus: vi.fn().mockReturnValue('idle') };
    mockWebContents = { send: vi.fn() };
  });

  it('registers handlers for task channels', () => {
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_CREATE, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_UPDATE, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_START, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_STOP, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_DELETE, expect.any(Function));
  });

  it('create handler returns created task', () => {
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_CREATE)[1];
    const result = handler({}, { name: 'Test Task' });
    expect(result.task.id).toBe('t1');
  });
});
```

- [ ] **Step 2: Implement task.ts**

```typescript
import type { IpcRegistry } from './registry';
import type { StorageService } from '../services/storage';
import type { TaskEngine } from '../services/task-engine';
import type { WebContents } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';

export function createTaskIpcHandlers(
  registry: IpcRegistry,
  storage: StorageService,
  taskEngine: TaskEngine,
  webContents: WebContents,
): void {
  if (registry.getHandler(IPC_CHANNELS.TASK_CREATE)) return;

  registry.handle(IPC_CHANNELS.TASK_CREATE, (_event: any, data: { name: string }) => {
    const task = storage.createTask({ name: data.name });
    return { task };
  });

  registry.handle(IPC_CHANNELS.TASK_UPDATE, (_event: any, data: { taskId: string; updates: any }) => {
    storage.updateTask(data.taskId, data.updates);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_START, async (_event: any, data: { taskId: string }) => {
    taskEngine.start(data.taskId);
    webContents.send(IPC_CHANNELS.TASK_STATUS_CHANGED, { taskId: data.taskId, status: 'running' });
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_STOP, (_event: any, data: { taskId: string }) => {
    taskEngine.stop(data.taskId);
    webContents.send(IPC_CHANNELS.TASK_STATUS_CHANGED, { taskId: data.taskId, status: 'stopped' });
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_DELETE, (_event: any, data: { taskId: string }) => {
    storage.deleteTask(data.taskId);
    return { success: true };
  });
}
```

- [ ] **Step 3: Run tests and commit**

---

## Task 2: Task Group IPC Handlers

**Files:**
- Create: `src/main/ipc/task-group.ts`
- Create: `src/main/ipc/__tests__/task-group-ipc.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTaskGroupIpcHandlers } from '../task-group';
import { IPC_CHANNELS } from '@shared/constants';

describe('TaskGroup IPC Handlers', () => {
  let registry: any;
  let mockStorage: any;
  let mockTaskGroupEngine: any;

  beforeEach(() => {
    registry = { handle: vi.fn(), getHandler: vi.fn().mockReturnValue(undefined) };
    mockStorage = {
      createTaskGroup: vi.fn().mockReturnValue({ id: 'g1', name: 'Group' }),
      getTaskGroup: vi.fn(),
      listTaskGroups: vi.fn().mockReturnValue([]),
      addTaskGroupItem: vi.fn(),
      listTaskGroupItems: vi.fn().mockReturnValue([]),
      deleteTaskGroupItem: vi.fn(),
      deleteTaskGroup: vi.fn(),
    };
    mockTaskGroupEngine = { start: vi.fn(), stop: vi.fn() };
  });

  it('registers handlers for task group channels', () => {
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_CREATE, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_DELETE, expect.any(Function));
  });
});
```

- [ ] **Step 2: Implement task-group.ts**

```typescript
import type { IpcRegistry } from './registry';
import type { StorageService } from '../services/storage';
import type { TaskGroupEngine } from '../services/task-group-engine';
import { IPC_CHANNELS } from '@shared/constants';

export function createTaskGroupIpcHandlers(
  registry: IpcRegistry,
  storage: StorageService,
  taskGroupEngine: TaskGroupEngine,
): void {
  if (registry.getHandler(IPC_CHANNELS.TASK_GROUP_CREATE)) return;

  registry.handle(IPC_CHANNELS.TASK_GROUP_CREATE, (_event: any, data: { name: string; failurePolicy: string }) => {
    const group = storage.createTaskGroup({ name: data.name, failurePolicy: data.failurePolicy });
    return { group };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_DELETE, (_event: any, data: { taskGroupId: string }) => {
    storage.deleteTaskGroup(data.taskGroupId);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_START, async (_event: any, data: { taskGroupId: string }) => {
    taskGroupEngine.start(data.taskGroupId);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_STOP, (_event: any, data: { taskGroupId: string }) => {
    taskGroupEngine.stop(data.taskGroupId);
    return { success: true };
  });
}
```

- [ ] **Step 3: Run tests and commit**

---

## Task 3: Task Store

**Files:**
- Create: `src/renderer/stores/taskStore.ts`

- [ ] **Step 1: Implement taskStore.ts**

```typescript
import { create } from 'zustand';
import type { Task, Step, StepGroup, TaskSettings, InterruptHandler, StepType, StepTransition, ImageMatchConfig, ImageGroupMatchConfig, ClickConfig } from '@shared/types/task';

interface TaskState {
  tasks: Task[];
  selectedTaskId: string | null;
  steps: Step[];
  setTasks: (tasks: Task[]) => void;
  selectTask: (taskId: string | null) => void;
  setSteps: (steps: Step[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  selectedTaskId: null,
  steps: [],
  setTasks: (tasks) => set({ tasks }),
  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  setSteps: (steps) => set({ steps }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
  })),
  removeTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== taskId),
    selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
  })),
}));
```

- [ ] **Step 2: Commit**

---

## Task 4: Task List UI

**Files:**
- Create: `src/renderer/components/Assistant/TaskList.tsx`

- [ ] **Step 1: Implement TaskList.tsx**

```tsx
import React from 'react';
import { List, Button, Space, Tag, Popconfirm } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTaskStore } from '../../stores/taskStore';
import type { TaskStatus } from '@shared/types/task';

const statusColors: Record<TaskStatus, string> = {
  idle: 'default', running: 'processing', paused: 'warning',
  completed: 'success', failed: 'error', stopped: 'default',
};

interface TaskListProps {
  onEdit: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ onEdit }) => {
  const { tasks, selectTask, removeTask } = useTaskStore();

  const handleStart = (taskId: string) => {
    (window as any).electronAPI?.invoke('task:start', { taskId });
  };

  const handleStop = (taskId: string) => {
    (window as any).electronAPI?.invoke('task:stop', { taskId });
  };

  return (
    <List
      dataSource={tasks}
      renderItem={(task) => (
        <List.Item
          actions={[
            task.status === 'running' ? (
              <Button icon={<PauseCircleOutlined />} size="small" onClick={() => handleStop(task.id)} />
            ) : (
              <Button icon={<PlayCircleOutlined />} type="primary" size="small" onClick={() => handleStart(task.id)} />
            ),
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(task.id)} />,
            <Popconfirm title="Delete?" onConfirm={() => removeTask(task.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>,
          ]}
        >
          <List.Item.Meta
            title={task.name}
            description={<Tag color={statusColors[task.status]}>{task.status}</Tag>}
          />
        </List.Item>
      )}
    />
  );
};
```

- [ ] **Step 2: Commit**

---

## Task 5: Step Editor UI

**Files:**
- Create: `src/renderer/components/Assistant/StepEditor.tsx`

- [ ] **Step 1: Implement StepEditor.tsx**

```tsx
import React from 'react';
import { Form, Input, InputNumber, Select, Switch, Card, Space, Button } from 'antd';
import type { Step, StepType, ImageMatchConfig, ClickConfig } from '@shared/types/task';

interface StepEditorProps {
  step?: Step;
  taskId: string;
  onSave: (step: Partial<Step>) => void;
  onCancel: () => void;
}

const STEP_TYPES: { label: string; value: StepType }[] = [
  { label: 'Image Match', value: 'IMAGE_MATCH' },
  { label: 'Image Group', value: 'IMAGE_GROUP' },
  { label: 'Click', value: 'CLICK' },
];

export const StepEditor: React.FC<StepEditorProps> = ({ step, taskId, onSave, onCancel }) => {
  const [form] = Form.useForm();

  const handleSubmit = (values: any) => {
    onSave({
      ...values,
      taskId,
      config: buildConfig(values),
      onMatch: { action: values.onMatchAction, nextStepId: values.onMatchNextStepId },
      onMiss: { action: values.onMissAction, nextStepId: values.onMissNextStepId },
    });
  };

  return (
    <Card title={step ? 'Edit Step' : 'Add Step'} size="small">
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={step ? {
        type: step.type,
        screenshotBeforeMatch: step.screenshotBeforeMatch,
        ...(step.config as any),
        onMatchAction: step.onMatch.action,
        onMatchNextStepId: step.onMatch.nextStepId,
        onMissAction: step.onMiss.action,
        onMissNextStepId: step.onMiss.nextStepId,
      } : { type: 'IMAGE_MATCH', threshold: 0.8, scaleRange: [0.5, 2.0], screenshotBeforeMatch: false }}>
        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
          <Select options={STEP_TYPES} />
        </Form.Item>
        <Form.Item name="screenshotBeforeMatch" label="Fresh Screenshot" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
          {({ getFieldValue }) => {
            const type = getFieldValue('type');
            if (type === 'IMAGE_MATCH') return <ImageMatchFields />;
            if (type === 'CLICK') return <ClickFields />;
            return null;
          }}
        </Form.Item>

        <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit">Save</Button>
        </Space>
      </Form>
    </Card>
  );
};

const ImageMatchFields: React.FC = () => (
  <>
    <Form.Item name="templatePath" label="Template Path" rules={[{ required: true }]}>
      <Input placeholder="/path/to/template.png" />
    </Form.Item>
    <Form.Item name="threshold" label="Threshold">
      <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
    </Form.Item>
  </>
);

const ClickFields: React.FC = () => (
  <>
    <Form.Item name="source" label="Source" rules={[{ required: true }]}>
      <Select options={[{ label: 'Fixed', value: 'fixed' }, { label: 'From Step', value: 'from_step' }]} />
    </Form.Item>
    <Form.Item name={['fixedCoords', 'x']} label="X">
      <InputNumber style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name={['fixedCoords', 'y']} label="Y">
      <InputNumber style={{ width: '100%' }} />
    </Form.Item>
  </>
);

function buildConfig(values: any): any {
  if (values.type === 'IMAGE_MATCH') {
    return { templatePath: values.templatePath, threshold: values.threshold, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: values.scaleRange || [0.5, 2.0] };
  }
  if (values.type === 'CLICK') {
    return { source: values.source, fixedCoords: values.fixedCoords, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' };
  }
  return {};
}
```

- [ ] **Step 2: Commit**

---

## Task 6: Task Editor UI

**Files:**
- Create: `src/renderer/components/Assistant/TaskEditor.tsx`

- [ ] **Step 1: Implement TaskEditor.tsx**

```tsx
import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Space, List, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { StepEditor } from './StepEditor';
import type { Step } from '@shared/types/task';

interface TaskEditorProps {
  taskId: string;
  onClose: () => void;
}

export const TaskEditor: React.FC<TaskEditorProps> = ({ taskId, onClose }) => {
  const [task, setTask] = useState<any>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [showStepEditor, setShowStepEditor] = useState(false);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const taskResult = await api.invoke('task:get', { taskId });
    const stepsResult = await api.invoke('task:get-steps', { taskId });
    setTask(taskResult?.task);
    setSteps(stepsResult?.steps || []);
  };

  const handleSaveStep = async (stepData: Partial<Step>) => {
    const api = (window as any).electronAPI;
    await api.invoke('task:create-step', { step: { ...stepData, taskId } });
    setShowStepEditor(false);
    loadTask();
  };

  const handleDeleteStep = async (stepId: string) => {
    const api = (window as any).electronAPI;
    await api.invoke('task:delete-step', { stepId });
    loadTask();
  };

  if (!task) return null;

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Card title={`Edit: ${task.name}`} extra={<Button onClick={onClose}>Close</Button>}>
        <Form layout="vertical" initialValues={task} onFinish={async (values) => {
          const api = (window as any).electronAPI;
          await api.invoke('task:update', { taskId, updates: values });
          loadTask();
        }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit">Save Task</Button>
        </Form>
      </Card>

      <Card title="Steps" extra={<Button icon={<PlusOutlined />} onClick={() => setShowStepEditor(true)}>Add Step</Button>}>
        <List
          dataSource={steps}
          renderItem={(step, index) => (
            <List.Item actions={[
              <Button icon={<EditOutlined />} size="small" onClick={() => { setEditingStep(step); setShowStepEditor(true); }} />,
              <Popconfirm title="Delete?" onConfirm={() => handleDeleteStep(step.id)}>
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Popconfirm>,
            ]}>
              <List.Item.Meta title={`${index + 1}. ${step.type}`} description={step.config && 'templatePath' in step.config ? (step.config as any).templatePath : ''} />
            </List.Item>
          )}
        />
      </Card>

      {showStepEditor && (
        <StepEditor step={editingStep || undefined} taskId={taskId} onSave={handleSaveStep} onCancel={() => { setShowStepEditor(false); setEditingStep(null); }} />
      )}
    </Space>
  );
};
```

- [ ] **Step 2: Commit**

---

## Task 7: Task Group Editor UI

**Files:**
- Create: `src/renderer/components/Assistant/TaskGroupList.tsx`
- Create: `src/renderer/components/Assistant/TaskGroupEditor.tsx`

- [ ] **Step 1: Implement TaskGroupList.tsx**

```tsx
import React, { useState } from 'react';
import { List, Button, Space, Tag, Popconfirm, Modal, Form, Input, Select } from 'antd';
import { PlusOutlined, PlayCircleOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';

export const TaskGroupList: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form] = Form.useForm();

  React.useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const result = await api.invoke('task-group:list');
    setGroups(result?.groups || []);
  };

  const handleCreate = async (values: any) => {
    const api = (window as any).electronAPI;
    await api.invoke('task-group:create', values);
    setShowCreate(false);
    form.resetFields();
    loadGroups();
  };

  const handleDelete = async (groupId: string) => {
    const api = (window as any).electronAPI;
    await api.invoke('task-group:delete', { taskGroupId: groupId });
    loadGroups();
  };

  return (
    <>
      <Button icon={<PlusOutlined />} onClick={() => setShowCreate(true)} style={{ marginBottom: 8 }}>New Group</Button>
      <List
        dataSource={groups}
        renderItem={(group) => (
          <List.Item actions={[
            <Button icon={<PlayCircleOutlined />} type="primary" size="small" />,
            <Popconfirm title="Delete?" onConfirm={() => handleDelete(group.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>,
          ]}>
            <List.Item.Meta title={group.name} description={<Tag>{group.failurePolicy}</Tag>} />
          </List.Item>
        )}
      />
      <Modal title="New Task Group" open={showCreate} onCancel={() => setShowCreate(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="failurePolicy" label="Failure Policy" initialValue="STOP">
            <Select options={[{ label: 'Stop', value: 'STOP' }, { label: 'Skip', value: 'SKIP' }, { label: 'Retry', value: 'RETRY' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
```

- [ ] **Step 2: Commit**

---

## Task 8: Wire into App.tsx

- [ ] **Step 1: Update App.tsx**

Replace the Assistant tab placeholder with TaskList and TaskGroupList. Add imports.

- [ ] **Step 2: Commit