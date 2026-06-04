import { dialog } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import type { TemplateStorage } from '../services/template-storage';
import type { IpcRegistry } from './registry';

export function createImageIpcHandlers(
  registry: IpcRegistry,
  templateStorage: TemplateStorage,
): void {
  registry.handle(IPC_CHANNELS.IMAGE_PICK, async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { sourcePath: null };
    }
    return { sourcePath: result.filePaths[0] };
  });

  registry.handle(IPC_CHANNELS.IMAGE_NORMALIZE, async (_event: any, args: { sourcePath: string }) => {
    const savedPath = await templateStorage.normalize(args.sourcePath);
    return { savedPath };
  });
}
