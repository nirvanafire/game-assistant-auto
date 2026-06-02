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
      createStep: vi.fn().mockReturnValue({ id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1 }),
      listSteps: vi.fn().mockReturnValue([]),
      deleteStep: vi.fn(),
    };
    mockTaskEngine = { start: vi.fn(), stop: vi.fn(), getStatus: vi.fn().mockReturnValue('idle') };
    mockWebContents = { send: vi.fn() };
  });

  it('registers handlers for task channels', () => {
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_CREATE, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_LIST, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_UPDATE, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_START, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_STOP, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_DELETE, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GET, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GET_STEPS, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_CREATE_STEP, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_DELETE_STEP, expect.any(Function));
  });

  it('create handler returns created task', () => {
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_CREATE)[1];
    const result = handler({}, { name: 'Test Task' });
    expect(result.task.id).toBe('t1');
    expect(mockStorage.createTask).toHaveBeenCalledWith({ name: 'Test Task' });
  });

  it('get handler returns task', () => {
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GET)[1];
    const result = handler({}, { taskId: 't1' });
    expect(result.task.id).toBe('t1');
    expect(mockStorage.getTask).toHaveBeenCalledWith('t1');
  });

  it('list handler returns all tasks', () => {
    mockStorage.listTasks.mockReturnValue([{ id: 't1' }, { id: 't2' }]);
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_LIST)[1];
    const result = handler({});
    expect(result.tasks).toEqual([{ id: 't1' }, { id: 't2' }]);
    expect(mockStorage.listTasks).toHaveBeenCalled();
  });

  it('get-steps handler returns steps', () => {
    mockStorage.listSteps.mockReturnValue([{ id: 's1' }]);
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GET_STEPS)[1];
    const result = handler({}, { taskId: 't1' });
    expect(result.steps).toEqual([{ id: 's1' }]);
  });

  it('create-step handler creates step', () => {
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_CREATE_STEP)[1];
    const stepData = { taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: {}, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true };
    handler({}, { step: stepData });
    expect(mockStorage.createStep).toHaveBeenCalledWith(stepData);
  });

  it('delete-step handler deletes step', () => {
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_DELETE_STEP)[1];
    handler({}, { stepId: 's1' });
    expect(mockStorage.deleteStep).toHaveBeenCalledWith('s1');
  });

  it('start handler sends status change', async () => {
    mockTaskEngine.start.mockResolvedValue(undefined);
    mockTaskEngine.getStatus.mockReturnValue('running');
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_START)[1];
    const result = await handler({}, { taskId: 't1' });
    expect(result).toEqual({ success: true });
    expect(mockTaskEngine.start).toHaveBeenCalledWith('t1');
    expect(mockWebContents.send).toHaveBeenCalledWith(IPC_CHANNELS.TASK_STATUS_CHANGED, { taskId: 't1', status: 'running' });
  });

  it('start handler propagates engine errors', async () => {
    mockTaskEngine.start.mockRejectedValue(new Error('Task not found: t1'));
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_START)[1];
    await expect(handler({}, { taskId: 't1' })).rejects.toThrow('Task not found: t1');
    expect(mockWebContents.send).not.toHaveBeenCalled();
  });

  it('stop handler sends status change', () => {
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_STOP)[1];
    handler({}, { taskId: 't1' });
    expect(mockTaskEngine.stop).toHaveBeenCalledWith('t1');
    expect(mockWebContents.send).toHaveBeenCalledWith(IPC_CHANNELS.TASK_STATUS_CHANGED, { taskId: 't1', status: 'stopped' });
  });

  it('does not register duplicate handlers', () => {
    registry.getHandler = vi.fn().mockReturnValue(() => {});
    createTaskIpcHandlers(registry, mockStorage, mockTaskEngine, mockWebContents);
    expect(registry.handle).not.toHaveBeenCalled();
  });
});
