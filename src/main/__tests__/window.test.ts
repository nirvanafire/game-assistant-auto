import { describe, it, expect } from 'vitest';

describe('createMainWindow', () => {
  it('should export createMainWindow function', async () => {
    const mod = await import('../window.js');
    expect(typeof mod.createMainWindow).toBe('function');
  });

  it('should export getMainWindow function', async () => {
    const mod = await import('../window.js');
    expect(typeof mod.getMainWindow).toBe('function');
  });
});
