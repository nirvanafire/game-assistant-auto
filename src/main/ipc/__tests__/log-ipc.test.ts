import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogIpcHandlers } from '../log';
import { IPC_CHANNELS } from '@shared/constants';

describe('Log IPC Handlers', () => {
  let registry: { handle: ReturnType<typeof vi.fn> };
  let logger: { setDebug: ReturnType<typeof vi.fn>; isDebugEnabled: ReturnType<typeof vi.fn>; setOnLogEntry: ReturnType<typeof vi.fn> };
  let webContents: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    registry = { handle: vi.fn(), getHandler: vi.fn().mockReturnValue(undefined) };
    logger = { setDebug: vi.fn(), isDebugEnabled: vi.fn().mockReturnValue(false), setOnLogEntry: vi.fn() };
    webContents = { send: vi.fn() };
  });

  it('registers handlers for all log channels', () => {
    createLogIpcHandlers(registry as any, logger as any, webContents as any);

    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.LOG_SET_DEBUG, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.LOG_GET_LOGS, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.LOG_EXPORT, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.LOG_CLEAR_DISPLAY, expect.any(Function));
  });

  it('sets up real-time log streaming', () => {
    createLogIpcHandlers(registry as any, logger as any, webContents as any);

    expect(logger.setOnLogEntry).toHaveBeenCalledWith(expect.any(Function));
  });

  it('streams log entries to renderer', () => {
    createLogIpcHandlers(registry as any, logger as any, webContents as any);

    // Get the callback passed to setOnLogEntry
    const callback = logger.setOnLogEntry.mock.calls[0][0];
    const entry = { timestamp: '2025-01-01T00:00:00.000Z', level: 'INFO', source: 'App', message: 'test' };
    callback(entry);

    expect(webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.LOG_ENTRY, entry);
  });

  it('set-debug handler toggles debug and broadcasts state', () => {
    createLogIpcHandlers(registry as any, logger as any, webContents as any);

    // Get the handler registered for LOG_SET_DEBUG
    const handler = registry.handle.mock.calls.find(
      (call: any[]) => call[0] === IPC_CHANNELS.LOG_SET_DEBUG
    )[1];

    const result = handler({}, { enabled: true });

    expect(logger.setDebug).toHaveBeenCalledWith(true);
    expect(webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.LOG_DEBUG_STATE, { enabled: true });
    expect(result).toEqual({ success: true });
  });

  it('skips registration if handlers are already registered', () => {
    registry.getHandler = vi.fn().mockReturnValue(() => {});

    createLogIpcHandlers(registry as any, logger as any, webContents as any);

    expect(registry.handle).not.toHaveBeenCalled();
    expect(logger.setOnLogEntry).not.toHaveBeenCalled();
  });
});
