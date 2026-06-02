import { ipcMain } from 'electron';

type IpcHandler = (event: any, ...args: any[]) => any;

export class IpcRegistry {
  private handlers = new Map<string, IpcHandler>();

  handle(channel: string, handler: IpcHandler): void {
    if (this.handlers.has(channel)) {
      throw new Error(`IPC handler already registered for channel: ${channel}`);
    }
    this.handlers.set(channel, handler);
    ipcMain.handle(channel, handler);
  }

  getHandler(channel: string): IpcHandler | undefined {
    return this.handlers.get(channel);
  }

  removeAll(): void {
    for (const channel of this.handlers.keys()) {
      ipcMain.removeHandler(channel);
    }
    this.handlers.clear();
  }
}
