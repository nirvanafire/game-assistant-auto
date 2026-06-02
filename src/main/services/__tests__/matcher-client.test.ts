import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatcherClient } from '../matcher-client';

global.fetch = vi.fn();

describe('MatcherClient', () => {
  let client: MatcherClient;

  beforeEach(() => {
    client = new MatcherClient('http://127.0.0.1:5000');
    vi.clearAllMocks();
  });

  it('calls /match endpoint', async () => {
    const mockResult = { matched: true, x: 100, y: 200, confidence: 0.95, scale: 1.0 };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await client.match({
      screenshot: 'base64data',
      template: 'base64data',
      threshold: 0.8,
      scaleRange: [0.5, 2.0],
    });

    expect(result.matched).toBe(true);
    expect((result as any).x).toBe(100);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/match',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('calls /match-group endpoint', async () => {
    const mockResult = { results: [{ label: 'a', matched: true }] };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await client.matchGroup({
      screenshot: 'base64data',
      templates: [{ label: 'a', image: 'base64data', threshold: 0.8 }],
      logic: 'ALL',
      scaleRange: [0.5, 2.0],
    });

    expect(result.results).toHaveLength(1);
  });

  it('calls /health endpoint', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', version: '1.0.0', opencv_version: '4.8.0' }),
    });

    const result = await client.health();
    expect(result.status).toBe('ok');
  });

  it('throws on HTTP error', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(client.health()).rejects.toThrow('HTTP 500');
  });
});
