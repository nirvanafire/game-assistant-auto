import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEngine } from '../task-engine';

describe('TaskEngine conditional step group execution', () => {
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

  it('match routes to onMatch step, miss routes to onMiss step', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/check.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { nextStepId: 's3' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 10, y: 10 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
      { id: 's3', taskId: 't1', type: 'CLICK', order: 3, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 20, y: 20 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Conditional', loopCount: 1 },
    ]);
    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledWith(10, 10);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('miss routes to onMiss step when match fails', async () => {
    mockMatcher.match.mockResolvedValue({ matched: false });
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/check.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { nextStepId: 's3' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 10, y: 10 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
      { id: 's3', taskId: 't1', type: 'CLICK', order: 3, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 20, y: 20 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Conditional', loopCount: 1 },
    ]);
    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledWith(20, 20);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('END_STEP_GROUP exits the group loop', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/check.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_STEP_GROUP' }, onMiss: { nextStepId: 's2' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 50, y: 50 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
      { id: 's3', taskId: 't1', type: 'IMAGE_MATCH', order: 3, config: { templatePath: '/final.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Early Exit', loopCount: 5 },
    ]);
    await engine.start('t1');
    expect(mockClicker.click).not.toHaveBeenCalled();
    expect(mockMatcher.match).toHaveBeenCalledTimes(2);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('conditional paths can converge to same step', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/check.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's3' }, onMiss: { nextStepId: 's3' }, screenshotBeforeMatch: true, realtimeMatch: true, cacheCoordinates: false },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 99, y: 99 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
      { id: 's3', taskId: 't1', type: 'CLICK', order: 3, groupId: 'sg1', config: { source: 'fixed', fixedCoords: { x: 42, y: 42 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, screenshotBeforeMatch: false, realtimeMatch: false, cacheCoordinates: false },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Converge', loopCount: 1 },
    ]);
    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledTimes(1);
    expect(mockClicker.click).toHaveBeenCalledWith(42, 42);
  });
});
