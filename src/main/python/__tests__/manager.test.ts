// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

const { mockSpawn } = vi.hoisted(() => {
  const mockSpawn = vi.fn(() => {
    const proc = {
      pid: 12345,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'spawn') setTimeout(() => cb(), 10);
      }),
      kill: vi.fn(),
      killed: false,
    };
    return proc;
  });
  return { mockSpawn };
});

vi.mock(import('child_process'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    spawn: mockSpawn,
  };
});

vi.mock(import('../port'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    findAvailablePort: vi.fn().mockResolvedValue(5000),
  };
});

const { PythonManager } = await import('../manager');

describe('PythonManager', () => {
  it('starts with idle status', () => {
    const manager = new PythonManager('/path/to/service');
    expect(manager.getStatus()).toBe('idle');
  });

  it('returns port after start', async () => {
    const manager = new PythonManager('/path/to/service');
    const port = await manager.start();
    expect(port).toBe(5000);
    expect(manager.getStatus()).toBe('running');
  });

  it('kills process on stop', async () => {
    const manager = new PythonManager('/path/to/service');
    await manager.start();
    manager.stop();
    expect(manager.getStatus()).toBe('stopped');
  });

  it('returns url', async () => {
    const manager = new PythonManager('/path/to/service');
    await manager.start();
    expect(manager.getUrl()).toBe('http://127.0.0.1:5000');
  });
});
