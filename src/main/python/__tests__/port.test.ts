import { describe, it, expect } from 'vitest';
import { findAvailablePort } from '../port';

describe('findAvailablePort', () => {
  it('returns a number', async () => {
    const port = await findAvailablePort();
    expect(typeof port).toBe('number');
    expect(port).toBeGreaterThan(0);
  });

  it('returns preferred port when available', async () => {
    const port = await findAvailablePort(15555);
    expect(port).toBe(15555);
  });
});
