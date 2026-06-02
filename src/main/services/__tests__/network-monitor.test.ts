import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkMonitor } from '../network-monitor';

describe('NetworkMonitor', () => {
  let monitor: NetworkMonitor;
  let mockDb: any;
  let mockWebContents: any;
  let mockLogger: any;

  beforeEach(() => {
    mockDb = { prepare: vi.fn().mockReturnValue({ run: vi.fn(), all: vi.fn().mockReturnValue([]) }) };
    mockWebContents = {
      debugger: { attach: vi.fn(), detach: vi.fn(), sendCommand: vi.fn(), on: vi.fn() },
    };
    mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
    monitor = new NetworkMonitor(mockDb, mockWebContents, mockLogger, '/tmp/test-logs');
  });

  it('starts in stopped state', () => { expect(monitor.isCapturing()).toBe(false); });

  it('attaches CDP on start', async () => {
    await monitor.start();
    expect(mockWebContents.debugger.attach).toHaveBeenCalledWith('1.3');
    expect(monitor.isCapturing()).toBe(true);
  });

  it('detaches CDP on stop', async () => {
    await monitor.start();
    monitor.stop();
    expect(monitor.isCapturing()).toBe(false);
  });
});
