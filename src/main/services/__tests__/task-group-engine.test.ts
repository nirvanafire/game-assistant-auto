import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskGroupEngine } from '../task-group-engine';

describe('TaskGroupEngine', () => {
  let engine: TaskGroupEngine;
  let mockStorage: any;
  let mockTaskEngine: any;

  beforeEach(() => {
    mockStorage = {
      getTaskGroup: vi.fn().mockReturnValue({ id: 'g1', name: 'Group', failurePolicy: 'STOP', retryCount: 0 }),
      listTaskGroupItems: vi.fn().mockReturnValue([
        { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 1 },
        { id: 'i2', taskGroupId: 'g1', taskId: 't2', order: 2 },
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

  it('executes tasks serially', async () => {
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(2);
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(1, 't1');
    expect(mockTaskEngine.start).toHaveBeenNthCalledWith(2, 't2');
  });

  it('stops on failure with STOP policy', async () => {
    mockTaskEngine.getStatus.mockReturnValueOnce('failed').mockReturnValueOnce('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(1);
  });

  it('skips failure with SKIP policy', async () => {
    mockStorage.getTaskGroup.mockReturnValue({ id: 'g1', name: 'Group', failurePolicy: 'SKIP', retryCount: 0 });
    mockTaskEngine.getStatus.mockReturnValueOnce('failed').mockReturnValueOnce('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(2);
  });

  it('retries on failure with RETRY policy', async () => {
    mockStorage.getTaskGroup.mockReturnValue({ id: 'g1', name: 'Group', failurePolicy: 'RETRY', retryCount: 2 });
    mockTaskEngine.getStatus.mockReturnValueOnce('failed').mockReturnValueOnce('completed').mockReturnValueOnce('completed');
    await engine.start('g1');
    expect(mockTaskEngine.start).toHaveBeenCalledTimes(3);
  });

  it('throws on missing group', async () => {
    mockStorage.getTaskGroup.mockReturnValue(undefined);
    await expect(engine.start('missing')).rejects.toThrow('not found');
  });

  it('persists task group run history', async () => {
    await engine.start('g1');
    expect(mockStorage.createTaskGroupRun).toHaveBeenCalledWith({ taskGroupId: 'g1' });
    expect(mockStorage.updateTaskGroupRun).toHaveBeenCalledWith('grun-1', expect.objectContaining({ result: 'completed' }));
  });
});
