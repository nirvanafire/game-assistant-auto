import type { IpcRegistry } from './registry';
import type { StorageService } from '../services/storage';
import type { TaskGroupEngine } from '../services/task-group-engine';
import { IPC_CHANNELS } from '@shared/constants';

export function createTaskGroupIpcHandlers(
  registry: IpcRegistry,
  storage: StorageService,
  taskGroupEngine: TaskGroupEngine,
): void {
  if (registry.getHandler(IPC_CHANNELS.TASK_GROUP_CREATE)) return;

  registry.handle(IPC_CHANNELS.TASK_GROUP_CREATE, (_event: any, data: { name: string; failurePolicy: string }) => {
    const group = storage.createTaskGroup({ name: data.name, failurePolicy: data.failurePolicy as any });
    return { group };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_LIST, () => {
    const groups = storage.listTaskGroups();
    return { groups };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_DELETE, (_event: any, data: { taskGroupId: string }) => {
    storage.deleteTaskGroup(data.taskGroupId);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_START, async (_event: any, data: { taskGroupId: string }) => {
    await taskGroupEngine.start(data.taskGroupId);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_STOP, (_event: any, data: { taskGroupId: string }) => {
    taskGroupEngine.stop(data.taskGroupId);
    return { success: true };
  });
}
