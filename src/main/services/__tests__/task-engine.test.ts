import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEngine } from '../task-engine';

describe('TaskEngine', () => {
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
      listSteps: vi.fn().mockReturnValue([
        { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
      ]),
      listStepGroups: vi.fn().mockReturnValue([]),
      updateTask: vi.fn(),
      createTaskRun: vi.fn().mockReturnValue('run-1'),
      updateTaskRun: vi.fn(),
    };
    mockCapture = { capture: vi.fn().mockResolvedValue('data:image/png;base64,abc'), captureRegion: vi.fn() };
    mockMatcher = { match: vi.fn().mockResolvedValue({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 }), matchGroup: vi.fn(), health: vi.fn().mockResolvedValue({ status: 'ok' }) };
    mockClicker = { click: vi.fn(), clickAt: vi.fn() };
    engine = new TaskEngine(mockStorage, mockCapture, mockMatcher, mockClicker);
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

  it('executes step group with loop count', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: {}, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
      { id: 's2', taskId: 't1', type: 'IMAGE_MATCH', order: 2, groupId: 'sg1', config: { templatePath: '/img2.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: {}, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
      { id: 's3', taskId: 't1', type: 'IMAGE_MATCH', order: 3, groupId: null, config: { templatePath: '/img3.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Loop Group', loopCount: 2 },
    ]);
    await engine.start('t1');
    expect(mockMatcher.match).toHaveBeenCalledTimes(5);
  });

  it('stops infinite loop on END_GROUP_LOOP', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, groupId: 'sg1', config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { action: 'END_GROUP_LOOP' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
    ]);
    mockStorage.listStepGroups.mockReturnValue([
      { id: 'sg1', taskId: 't1', name: 'Infinite Loop', loopCount: 0 },
    ]);
    await engine.start('t1');
    expect(mockMatcher.match).toHaveBeenCalledTimes(1);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('checks interrupt handlers before each step', async () => {
    mockStorage.getTask.mockReturnValue({
      id: 't1', name: 'Test', status: 'idle',
      settings: { screenshotBeforeMatch: false, maxRetries: 3, globalTimeoutMs: 60000, stepTimeoutMs: 10000 },
      interruptHandlers: [{
        id: 'ih1', label: 'Close Popup', templatePath: '/popup.png',
        threshold: 0.9, action: 'CLICK_AT_MATCH', priority: 1,
      }],
    });
    mockMatcher.match
      .mockResolvedValueOnce({ matched: true, x: 50, y: 50, confidence: 0.95, scale: 1.0 })
      .mockResolvedValueOnce({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 });

    await engine.start('t1');
    expect(mockMatcher.match).toHaveBeenCalledTimes(2);
    expect(mockClicker.click).toHaveBeenCalledWith(50, 50);
  });

  it('handles CLICK_FIXED interrupt', async () => {
    mockStorage.getTask.mockReturnValue({
      id: 't1', name: 'Test', status: 'idle',
      settings: { screenshotBeforeMatch: false, maxRetries: 3, globalTimeoutMs: 60000, stepTimeoutMs: 10000 },
      interruptHandlers: [{
        id: 'ih1', label: 'Close Ad', templatePath: '/ad.png',
        threshold: 0.9, action: 'CLICK_FIXED', fixedCoords: { x: 10, y: 10 }, priority: 1,
      }],
    });
    mockMatcher.match
      .mockResolvedValueOnce({ matched: true, x: 50, y: 50, confidence: 0.95, scale: 1.0 })
      .mockResolvedValueOnce({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 });

    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledWith(10, 10);
  });

  it('persists task run history', async () => {
    await engine.start('t1');
    expect(mockStorage.createTaskRun).toHaveBeenCalledWith({ taskId: 't1' });
    expect(mockStorage.updateTaskRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ result: 'completed' }));
  });

  it('persists failed task run history', async () => {
    mockMatcher.match.mockRejectedValue(new Error('matcher broke'));
    await engine.start('t1');
    expect(mockStorage.createTaskRun).toHaveBeenCalledWith({ taskId: 't1' });
    expect(mockStorage.updateTaskRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ result: 'failed' }));
  });

  it('persists stopped task run history', async () => {
    const promise = engine.start('t1');
    engine.stop('t1');
    await promise;
    expect(mockStorage.createTaskRun).toHaveBeenCalledWith({ taskId: 't1' });
    expect(mockStorage.updateTaskRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ result: 'stopped' }));
  });

  it('fails task when Python service is unhealthy', async () => {
    mockMatcher.health.mockRejectedValue(new Error('Connection refused'));
    await engine.start('t1');
    expect(engine.getStatus('t1')).toBe('failed');
    expect(mockMatcher.match).not.toHaveBeenCalled();
  });

  it('retries match on network failure and succeeds', async () => {
    mockMatcher.match
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 });
    await engine.start('t1');
    expect(mockMatcher.match).toHaveBeenCalledTimes(2);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('CLICK step actually clicks match coordinates', async () => {
    mockStorage.listSteps.mockReturnValue([
      { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: { nextStepId: 's2' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
      { id: 's2', taskId: 't1', type: 'CLICK', order: 2, config: { source: 'from_step', stepId: 's1' }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: false },
    ]);
    await engine.start('t1');
    expect(mockClicker.click).toHaveBeenCalledWith(100, 200);
    expect(engine.getStatus('t1')).toBe('completed');
  });

  it('creates TaskRun record on health check failure', async () => {
    mockMatcher.health.mockRejectedValue(new Error('Connection refused'));
    await engine.start('t1');
    expect(mockStorage.createTaskRun).toHaveBeenCalledWith({ taskId: 't1' });
    expect(mockStorage.updateTaskRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ result: 'failed' }));
  });

  it('populates run log with step results', async () => {
    await engine.start('t1');
    expect(mockStorage.updateTaskRun).toHaveBeenCalledWith('run-1', expect.objectContaining({
      log: expect.arrayContaining([
        expect.objectContaining({ stepId: 's1', type: 'IMAGE_MATCH', matched: true }),
      ]),
    }));
  });
});
