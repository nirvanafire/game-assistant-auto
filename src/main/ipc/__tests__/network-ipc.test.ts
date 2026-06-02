import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNetworkIpcHandlers } from '../network';
import { IPC_CHANNELS } from '@shared/constants';

describe('Network IPC Handlers', () => {
  let registry: { handle: ReturnType<typeof vi.fn>; getHandler: ReturnType<typeof vi.fn> };
  let monitor: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; isCapturing: ReturnType<typeof vi.fn>; getLogs: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    registry = { handle: vi.fn(), getHandler: vi.fn().mockReturnValue(undefined) };
    monitor = { start: vi.fn(), stop: vi.fn(), isCapturing: vi.fn(), getLogs: vi.fn().mockReturnValue([]) };
  });

  it('registers all network IPC handlers', () => {
    createNetworkIpcHandlers(registry as any, monitor as any);
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.NETWORK_START, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.NETWORK_STOP, expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith(IPC_CHANNELS.NETWORK_GET_LOGS, expect.any(Function));
  });

  it('skips registration if handlers already exist', () => {
    registry.getHandler = vi.fn().mockReturnValue(() => {});
    createNetworkIpcHandlers(registry as any, monitor as any);
    expect(registry.handle).not.toHaveBeenCalled();
  });

  it('network:start handler calls monitor.start', async () => {
    createNetworkIpcHandlers(registry as any, monitor as any);
    const handler = registry.handle.mock.calls.find(
      (call: any[]) => call[0] === IPC_CHANNELS.NETWORK_START
    )[1];
    const result = await handler({});
    expect(monitor.start).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('network:stop handler calls monitor.stop', () => {
    createNetworkIpcHandlers(registry as any, monitor as any);
    const handler = registry.handle.mock.calls.find(
      (call: any[]) => call[0] === IPC_CHANNELS.NETWORK_STOP
    )[1];
    const result = handler({});
    expect(monitor.stop).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('network:get-logs handler returns logs', () => {
    const fakeLogs = [{ id: 1, timestamp: '2026-01-01', url: 'https://example.com' }];
    monitor.getLogs = vi.fn().mockReturnValue(fakeLogs);
    createNetworkIpcHandlers(registry as any, monitor as any);
    const handler = registry.handle.mock.calls.find(
      (call: any[]) => call[0] === IPC_CHANNELS.NETWORK_GET_LOGS
    )[1];
    const result = handler({}, { method: 'GET' });
    expect(monitor.getLogs).toHaveBeenCalledWith({ method: 'GET' });
    expect(result).toEqual({ logs: fakeLogs });
  });
});
