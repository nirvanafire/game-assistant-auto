import { describe, it, expect, vi } from 'vitest';
import { CaptureService } from '../capture';

describe('CaptureService', () => {
  it('captures screenshot as base64', async () => {
    const mockWebContents = {
      capturePage: vi.fn().mockResolvedValue({
        toPNG: () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      }),
    };
    const service = new CaptureService(mockWebContents as any);
    const result = await service.capture();
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it('captures region only', async () => {
    const mockWebContents = {
      capturePage: vi.fn().mockResolvedValue({
        toPNG: () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      }),
    };
    const service = new CaptureService(mockWebContents as any);
    const result = await service.captureRegion({ x: 10, y: 20, width: 100, height: 50 });
    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(mockWebContents.capturePage).toHaveBeenCalledWith({ x: 10, y: 20, width: 100, height: 50 });
  });
});
