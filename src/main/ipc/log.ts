import type { IpcRegistry } from './registry';
import type { Logger } from '../services/logger';
import { IPC_CHANNELS } from '@shared/constants';

export function createLogIpcHandlers(
  registry: IpcRegistry,
  logger: Logger,
  webContents: Electron.WebContents
): void {
  if (registry.getHandler(IPC_CHANNELS.LOG_SET_DEBUG)) {
    return;
  }

  logger.setOnLogEntry((entry) => {
    webContents.send(IPC_CHANNELS.LOG_ENTRY, entry);
  });

  registry.handle(IPC_CHANNELS.LOG_SET_DEBUG, (_event, data: { enabled: boolean }) => {
    logger.setDebug(data.enabled);
    webContents.send(IPC_CHANNELS.LOG_DEBUG_STATE, { enabled: data.enabled });
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.LOG_GET_LOGS, (_event, _filters) => {
    return { logs: [] };
  });

  registry.handle(IPC_CHANNELS.LOG_EXPORT, (_event, _data) => {
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.LOG_CLEAR_DISPLAY, () => {
    return { success: true };
  });
}
