import { describe, it, expect } from 'vitest';
import type { Step, StepTransition, StepType } from '../task';

describe('Step types', () => {
  it('StepTransition includes NEXT_STEP action', () => {
    const transition: StepTransition = { action: 'NEXT_STEP' };
    expect(transition.action).toBe('NEXT_STEP');
  });

  it('StepTransition includes END_STEP_GROUP action', () => {
    const transition: StepTransition = { action: 'END_STEP_GROUP' };
    expect(transition.action).toBe('END_STEP_GROUP');
  });

  it('onMatch and onMiss are optional on Step', () => {
    const step: Step = {
      id: 's1',
      taskId: 't1',
      type: 'CLICK',
      order: 1,
      config: {
        source: 'fixed',
        fixedCoords: { x: 10, y: 20 },
        clickCount: 1,
        intervalMs: 0,
        delayMs: 0,
        button: 'left',
      },
      screenshotBeforeMatch: false,
      realtimeMatch: false,
      cacheCoordinates: false,
    };
    expect(step.onMatch).toBeUndefined();
    expect(step.onMiss).toBeUndefined();
  });

  it('IMAGE_MATCH step has realtimeMatch and cacheCoordinates fields', () => {
    const step: Step = {
      id: 's1',
      taskId: 't1',
      type: 'IMAGE_MATCH',
      order: 1,
      config: {
        templatePath: '/img.png',
        threshold: 0.8,
        delayMs: 0,
        retryCount: 0,
        retryIntervalMs: 0,
        scaleRange: [0.5, 2.0],
      },
      onMatch: { action: 'END_TASK' },
      onMiss: { action: 'END_TASK' },
      screenshotBeforeMatch: true,
      realtimeMatch: true,
      cacheCoordinates: true,
    };
    expect(step.realtimeMatch).toBe(true);
    expect(step.cacheCoordinates).toBe(true);
  });
});
