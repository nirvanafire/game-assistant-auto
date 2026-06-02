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
      createTaskGroup: vi.fn().mockReturnValue({ id: 'g1', name: 'Group', failurePolicy: 'STOP' }),
      getTaskGroup: vi.fn().mockReturnValue({ id: 'g1', name: 'Group' }),
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
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_LIST, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_START, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_STOP, expect.any(Function));
  });

  it('create handler returns created group', () => {
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_CREATE)[1];
    const result = handler({}, { name: 'Test Group', failurePolicy: 'STOP' });
    expect(result.group.id).toBe('g1');
    expect(mockStorage.createTaskGroup).toHaveBeenCalledWith({ name: 'Test Group', failurePolicy: 'STOP' });
  });

  it('list handler returns groups', () => {
    mockStorage.listTaskGroups.mockReturnValue([{ id: 'g1' }]);
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_LIST)[1];
    const result = handler({});
    expect(result.groups).toEqual([{ id: 'g1' }]);
  });

  it('delete handler deletes group', () => {
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_DELETE)[1];
    handler({}, { taskGroupId: 'g1' });
    expect(mockStorage.deleteTaskGroup).toHaveBeenCalledWith('g1');
  });

  it('start handler starts engine', async () => {
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_START)[1];
    await handler({}, { taskGroupId: 'g1' });
    expect(mockTaskGroupEngine.start).toHaveBeenCalledWith('g1');
  });

  it('stop handler stops engine', () => {
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_STOP)[1];
    handler({}, { taskGroupId: 'g1' });
    expect(mockTaskGroupEngine.stop).toHaveBeenCalledWith('g1');
  });

  it('does not register duplicate handlers', () => {
    registry.getHandler = vi.fn().mockReturnValue(() => {});
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    expect(registry.handle).not.toHaveBeenCalled();
  });
});
