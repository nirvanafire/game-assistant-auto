import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskGroupEngine } from '../task-group-engine';

describe('TaskGroupEngine branching and looping', () => {
  let engine: TaskGroupEngine;
  let mockStorage: any;
  let mockTaskEngine: any;

  beforeEach(() => {
    mockStorage = {
      getTaskGroup: vi.fn().mockReturnValue({
        id: 'g1', name: 'Group', failurePolicy: 'STOP', retryCount: 0,
        loopEnabled: false, loopIntervalMs: 0, loopMaxIterations: 0,
      }),
      listTaskGroupItems: vi.fn().mockReturnValue([
        { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: null, onFailure: null },
        { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 1, onSuccess: null, onFailure: null },
        { id: 'i3', taskGroupId: 'g1', taskId: 't3', order: 2, onSuccess: null, onFailure: null },
      ]),
      createTaskGroupRun: vi.fn().mockReturnValue('grun-1'),
      updateTaskGroupRun: vi.fn(),
    };
    mockTaskEngine = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      getStatus: vi.fn().mockReturnValue('completed'),
    };
    engine = new TaskGroupEngine(mockStorage, mockTaskEngine);
  });

  it('follows onSuccess jump target', async () => {
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: 'i3', onFailure: null },
      { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 1, onSuccess: null, onFailure: null },
      { id: 'i3', taskGroupId: 'g1', taskId: 't3', order: 2, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus.mockReturnValue('completed');
    await engine.start('g1');
    // t1 succeeds -> jumps to i3 (t3) -> t3 succeeds -> ends
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(2);
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(1, 't1');
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(2, 't3');
  });

  it('follows onFailure jump target', async () => {
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: 'i2', onFailure: 'i3' },
      { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 1, onSuccess: null, onFailure: null },
      { id: 'i3', taskGroupId: 'g1', taskId: 't3', order: 2, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus
      .mockReturnValueOnce('failed')   // t1 fails -> jumps to i3
      .mockReturnValueOnce('completed'); // t3 succeeds -> ends
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(2);
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(1, 't1');
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(2, 't3');
  });

  it('END target stops the group', async () => {
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: 'END', onFailure: null },
      { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 1, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus.mockReturnValue('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(1);
    expect(mockTaskEngine.start).toHaveBeenCalledWith('t1');
  });

  it('null onFailure ends group on failure', async () => {
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: null, onFailure: null },
      { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 1, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus.mockReturnValueOnce('failed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(1);
  });

  it('loops the group N times', async () => {
    mockStorage.getTaskGroup.mockReturnValue({
      id: 'g1', name: 'Group', failurePolicy: 'STOP', retryCount: 0,
      loopEnabled: true, loopIntervalMs: 0, loopMaxIterations: 3,
    });
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus.mockReturnValue('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(3);
  });

  it('infinite loop stops on stop()', async () => {
    mockStorage.getTaskGroup.mockReturnValue({
      id: 'g1', name: 'Group', failurePolicy: 'STOP', retryCount: 0,
      loopEnabled: true, loopIntervalMs: 100, loopMaxIterations: 0,
    });
    mockStorage.listTaskGroupItems.mockReturnValue([
      { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 0, onSuccess: null, onFailure: null },
    ]);
    mockTaskEngine.getStatus.mockReturnValue('completed');
    const promise = engine.start('g1');
    engine.stop('g1');
    await promise;
    // Should have run at least once but not infinitely
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(1);
  });

  it('non-looping group runs items once then ends', async () => {
    mockTaskEngine.getStatus.mockReturnValue('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(3);
  });
});
