import type { WebContents } from 'electron';

export class CaptureService {
  private webContents: WebContents;

  constructor(webContents: WebContents) {
    this.webContents = webContents;
  }

  async capture(): Promise<string> {
    const image = await this.webContents.capturePage();
    const buffer = image.toPNG();
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }

  async captureRegion(region: { x: number; y: number; width: number; height: number }): Promise<string> {
    const image = await this.webContents.capturePage(region);
    const buffer = image.toPNG();
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }
}
