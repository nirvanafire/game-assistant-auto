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
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_GET, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_GET_ITEMS, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_ADD_ITEM, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_REMOVE_ITEM, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_UPDATE, expect.any(Function));
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

  it('get handler returns group by id', () => {
    mockStorage.getTaskGroup.mockReturnValue({ id: 'g1', name: 'Group' });
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_GET)[1];
    const result = handler({}, { taskGroupId: 'g1' });
    expect(result.group).toEqual({ id: 'g1', name: 'Group' });
    expect(mockStorage.getTaskGroup).toHaveBeenCalledWith('g1');
  });

  it('get-items handler returns items for group', () => {
    mockStorage.listTaskGroupItems.mockReturnValue([{ id: 'i1', taskId: 't1', order: 0 }]);
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_GET_ITEMS)[1];
    const result = handler({}, { taskGroupId: 'g1' });
    expect(result.items).toEqual([{ id: 'i1', taskId: 't1', order: 0 }]);
    expect(mockStorage.listTaskGroupItems).toHaveBeenCalledWith('g1');
  });

  it('add-item handler adds item to group', () => {
    mockStorage.addTaskGroupItem.mockReturnValue({ id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0 });
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_ADD_ITEM)[1];
    const result = handler({}, { taskGroupId: 'g1', taskId: 't1', order: 0 });
    expect(result.item.id).toBe('i1');
    expect(mockStorage.addTaskGroupItem).toHaveBeenCalledWith('g1', 't1', 0);
  });

  it('remove-item handler removes item', () => {
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_REMOVE_ITEM)[1];
    handler({}, { itemId: 'i1' });
    expect(mockStorage.deleteTaskGroupItem).toHaveBeenCalledWith('i1');
  });

  it('update handler updates group', () => {
    mockStorage.updateTaskGroup = vi.fn();
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_UPDATE)[1];
    handler({}, { taskGroupId: 'g1', updates: { name: 'New Name', failurePolicy: 'SKIP' } });
    expect(mockStorage.updateTaskGroup).toHaveBeenCalledWith('g1', { name: 'New Name', failurePolicy: 'SKIP' });
  });

  it('registers task-group:update-loop handler', () => {
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_UPDATE_LOOP, expect.any(Function));
  });

  it('registers task-group:update-item-target handler', () => {
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_UPDATE_ITEM_TARGET, expect.any(Function));
  });

  it('registers task-group:reorder-items handler', () => {
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.TASK_GROUP_REORDER_ITEMS, expect.any(Function));
  });

  it('update-loop handler calls storage.updateTaskGroupLoop', () => {
    mockStorage.updateTaskGroupLoop = vi.fn();
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_UPDATE_LOOP)[1];
    handler({}, { taskGroupId: 'g1', loopEnabled: true, loopIntervalMs: 30000, loopMaxIterations: 5 });
    expect(mockStorage.updateTaskGroupLoop).toHaveBeenCalledWith('g1', {
      loopEnabled: true, loopIntervalMs: 30000, loopMaxIterations: 5,
    });
  });

  it('update-item-target handler calls storage.updateTaskGroupItemTarget', () => {
    mockStorage.updateTaskGroupItemTarget = vi.fn();
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_UPDATE_ITEM_TARGET)[1];
    handler({}, { itemId: 'i1', onSuccess: 'i2', onFailure: 'END' });
    expect(mockStorage.updateTaskGroupItemTarget).toHaveBeenCalledWith('i1', 'i2', 'END');
  });

  it('reorder-items handler calls storage.reorderTaskGroupItems', () => {
    mockStorage.reorderTaskGroupItems = vi.fn();
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === IPC_CHANNELS.TASK_GROUP_REORDER_ITEMS)[1];
    handler({}, { taskGroupId: 'g1', itemIds: ['i2', 'i1'] });
    expect(mockStorage.reorderTaskGroupItems).toHaveBeenCalledWith('g1', ['i2', 'i1']);
  });

  it('does not register duplicate handlers', () => {
    registry.getHandler = vi.fn().mockReturnValue(() => {});
    createTaskGroupIpcHandlers(registry, mockStorage, mockTaskGroupEngine);
    expect(registry.handle).not.toHaveBeenCalled();
  });
});
