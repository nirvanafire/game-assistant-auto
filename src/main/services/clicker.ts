import type { WebContents } from 'electron';
import type { Logger } from './logger';

export interface ClickOptions {
  button?: 'left' | 'right';
  count?: number;
  intervalMs?: number;
}

export class ClickerService {
  private webContents: WebContents;
  private logger?: Logger;

  constructor(webContents: WebContents, logger?: Logger) {
    this.webContents = webContents;
    this.logger = logger;
  }

  async click(x: number, y: number, options?: ClickOptions): Promise<void> {
    const button = options?.button ?? 'left';
    const count = options?.count ?? 1;
    const intervalMs = options?.intervalMs ?? 0;

    this.logger?.debug('Clicker', `Click at (${x}, ${y}) button=${button}`);

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
