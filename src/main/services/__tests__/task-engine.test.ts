import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEngine } from '../task-engine';

describe('TaskEngine', () => {
  let engine: TaskEngine;
  let mockStorage: any;
  let mockCapture: any;
  let mockMatcher: any;

  beforeEach(() => {
    mockStorage = {
      getTask: vi.fn().mockReturnValue({
        id: 't1', name: 'Test', status: 'idle',
        settings: { screenshotBeforeMatch: false, maxRetries: 3, globalTimeoutMs: 60000, stepTimeoutMs: 10000 },
        interruptHandlers: [],
      }),
      listSteps: vi.fn().mockReturnValue([
        { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
      ]),
      updateTask: vi.fn(),
    };
    mockCapture = { capture: vi.fn().mockResolvedValue('data:image/png;base64,abc'), captureRegion: vi.fn() };
    mockMatcher = { match: vi.fn().mockResolvedValue({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 }), matchGroup: vi.fn(), health: vi.fn() };
    engine = new TaskEngine(mockStorage, mockCapture, mockMatcher);
  });

  it('starts with idle status', () => {
    expect(engine.getStatus('t1')).toBe('idle');
  });

  it('runs a task and completes on match', async () => {
    await engine.start('t1');
    expect(engine.getStatus('t1')).toBe('completed');
    expect(mockCapture.capture).toHaveBeenCalled();
    expect(mockMatcher.match).toHaveBeenCalled();
  });

  it('handles miss result', async () => {
    mockMatcher.match.mockResolvedValue({ matched: false });
    await engine.start('t1');
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('stops a running task', async () => {
    const promise = engine.start('t1');
    engine.stop('t1');
    await promise;
    expect(engine.getStatus('t1')).toBe('stopped');
  });

  it('executes multiple steps in sequence', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/a.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
      { id: 's2', taskId: 't1', type: 'IMAGE_MATCH', order: 2, config: { templatePath: '/b.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: false },
    ]);
    await engine.start('t1');
    expect(mockMatcher.match).toHaveBeenCalledTimes(2);
    expect(engine.getStatus('t1')).toBe('completed');
  });
});
