import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

import { IpcRegistry } from '../registry.js';
import { ipcMain } from 'electron';

describe('IpcRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers and calls a handler', () => {
    const registry = new IpcRegistry();
    const handler = vi.fn().mockReturnValue('result');
    registry.handle('test:channel', handler);

    const registeredHandler = registry.getHandler('test:channel');
    expect(registeredHandler).toBe(handler);
  });

  it('calls ipcMain.handle when registering', () => {
    const registry = new IpcRegistry();
    const handler = vi.fn();
    registry.handle('test:channel', handler);

    expect(ipcMain.handle).toHaveBeenCalledWith('test:channel', handler);
  });

  it('throws on duplicate registration', () => {
    const registry = new IpcRegistry();
    registry.handle('test:channel', vi.fn());
    expect(() => registry.handle('test:channel', vi.fn())).toThrow('already registered');
  });

  it('removes all handlers', () => {
    const registry = new IpcRegistry();
    registry.handle('channel:a', vi.fn());
    registry.handle('channel:b', vi.fn());
    registry.removeAll();

    expect(ipcMain.removeHandler).toHaveBeenCalledTimes(2);
    expect(registry.getHandler('channel:a')).toBeUndefined();
  });
});
