import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClickerService } from '../clicker';

describe('ClickerService', () => {
  let clicker: ClickerService;
  let mockWebContents: any;

  beforeEach(() => {
    mockWebContents = {
      sendInputEvent: vi.fn(),
    };
    clicker = new ClickerService(mockWebContents);
  });

  it('sends mouseDown and mouseUp for a single click', async () => {
    await clicker.click(100, 200);
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledWith({
      type: 'mouseDown', x: 100, y: 200, button: 'left', clickCount: 1,
    });
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledWith({
      type: 'mouseUp', x: 100, y: 200, button: 'left', clickCount: 1,
    });
  });

  it('supports right click', async () => {
    await clicker.click(50, 50, { button: 'right' });
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ button: 'right' }),
    );
  });

  it('supports multiple clicks with interval', async () => {
    await clicker.click(10, 20, { count: 2, intervalMs: 50 });
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledTimes(4);
  });

  it('supports fixed coordinate click via clickAt', async () => {
    await clicker.clickAt({ x: 300, y: 400 });
    expect(mockWebContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ x: 300, y: 400 }),
    );
  });
});
