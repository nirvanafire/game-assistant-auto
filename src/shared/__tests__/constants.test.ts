import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '../constants';

describe('IPC_CHANNELS', () => {
  it('includes BROWSER_RESIZED channel', () => {
    expect(IPC_CHANNELS.BROWSER_RESIZED).toBe('browser:resized');
  });

  it('includes TASK_CLEAR_COORDINATE_CACHE channel', () => {
    expect(IPC_CHANNELS.TASK_CLEAR_COORDINATE_CACHE).toBe('task:clear-coordinate-cache');
  });
});
