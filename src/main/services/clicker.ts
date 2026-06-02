import type { WebContents } from 'electron';

export interface ClickOptions {
  button?: 'left' | 'right';
  count?: number;
  intervalMs?: number;
}

export class ClickerService {
  private webContents: WebContents;

  constructor(webContents: WebContents) {
    this.webContents = webContents;
  }

  async click(x: number, y: number, options?: ClickOptions): Promise<void> {
    const button = options?.button ?? 'left';
    const count = options?.count ?? 1;
    const intervalMs = options?.intervalMs ?? 0;

    for (let i = 0; i < count; i++) {
      if (i > 0 && intervalMs > 0) {
        await this.delay(intervalMs);
      }
      this.webContents.sendInputEvent({
        type: 'mouseDown', x, y, button, clickCount: 1,
      });
      this.webContents.sendInputEvent({
        type: 'mouseUp', x, y, button, clickCount: 1,
      });
    }
  }

  async clickAt(coords: { x: number; y: number }, options?: ClickOptions): Promise<void> {
    await this.click(coords.x, coords.y, options);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
