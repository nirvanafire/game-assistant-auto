import { IPC_CHANNELS } from '@shared/constants';
import type { StorageService } from '../services/storage';
import type { IpcRegistry } from './registry';

export function createStepGroupIpcHandlers(
  registry: IpcRegistry,
  storage: StorageService,
): void {
  registry.handle(IPC_CHANNELS.STEP_GROUP_LIST, (_event: any, args: { taskId: string }) => {
    return { groups: storage.listStepGroupsByTask(args.taskId) };
  });

  registry.handle(IPC_CHANNELS.STEP_GROUP_CREATE, (_event: any, args: { taskId: string; name: string; loopCount: number }) => {
    const group = storage.createStepGroup(args);
    return { group };
  });

  registry.handle(IPC_CHANNELS.STEP_GROUP_UPDATE, (_event: any, args: { stepGroupId: string; patch: { name?: string; loopCount?: number } }) => {
    storage.updateStepGroup(args.stepGroupId, args.patch);
  });

  registry.handle(IPC_CHANNELS.STEP_GROUP_DELETE, (_event: any, args: { stepGroupId: string }) => {
    storage.deleteStepGroup(args.stepGroupId);
  });
}
