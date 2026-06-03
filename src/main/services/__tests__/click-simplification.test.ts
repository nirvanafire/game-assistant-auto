import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEngine } from '../task-engine';

describe('TaskEngine CLICK step simplification', () => {
  let engine: TaskEngine;
  let mockStorage: any;
  let mockCapture: any;
  let mockMatcher: any;
  let mockClicker: any;

  beforeEach(() => {
    mockStorage = {
      getTask: vi.fn().mockReturnValue({
        id: 't1', name: 'Test', status: 'idle',
        settings: { screenshotBeforeMatch: false, maxRetries: 3, globalTimeoutMs: 60000, stepTimeoutMs: 10000 },
        interruptHandlers: [],
      }),
      listSteps: vi.fn().mockReturnValue([]),
      listStepGroups: vi.fn().mockReturnValue([]),
      updateTask: vi.fn(),
      createTaskRun: vi.fn().mockReturnValue('run-1'),
      updateTaskRun: vi.fn(),
    };
    mockCapture = { capture: vi.fn().mockResolvedValue('data:image/png;base64,abc') };
    mockMatcher = {
      match: vi.fn().mockResolvedValue({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 }),
      matchGroup: vi.fn(),
      health: vi.fn().mockResolvedValue({ status: 'ok' }),
    };
    mockClicker = { click: vi.fn() };
    engine = new TaskEngine(mockStorage, mockCapture, mockMatcher, mockClicker);
  });

  it('CLICK step proceeds to next ordered step without onMatch/onMiss', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, config: { source: 'from_step', stepId: 's1', clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
      { id: 's3', taskId: 't1', type: 'IMAGE_MATCH', order: 3, config: { templatePath: '/done.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledWith(100, 200);
    expect(mockMatcher.match).toHaveBeenCalledTimes(2);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('CLICK step at end of task ends the task', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, config: { source: 'from_step', stepId: 's1', clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledWith(100, 200);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('CLICK step at end of step group ends the group loop', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, groupId: 'sg1', config: { source: 'from_step', stepId: 's1', clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Loop', loopCount: 3 },
    ]);
    await engine.start('t1');
    expect(mockMatcher.match).toHaveBeenCalledTimes(3);
    expect(mockClicker.click).toHaveBeenCalledTimes(3);
    expect(engine.getStatus('t1')).toBe('completed');
  });
});
