import type { IpcRegistry } from './registry';
import type { NetworkMonitor } from '../services/network-monitor';
import { IPC_CHANNELS } from '@shared/constants';

export function createNetworkIpcHandlers(registry: IpcRegistry, monitor: NetworkMonitor): void {
  if (registry.getHandler(IPC_CHANNELS.NETWORK_START)) return;

  registry.handle(IPC_CHANNELS.NETWORK_START, async () => {
    await monitor.start();
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.NETWORK_STOP, () => {
    monitor.stop();
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.NETWORK_GET_LOGS, (_event: any, filters?: any) => {
    return { logs: monitor.getLogs(filters) };
  });

  registry.handle(IPC_CHANNELS.NETWORK_EXPORT, (_event: any, filters?: any) => {
    const json = monitor.exportLogs(filters);
    return { json };
  });
}
