import type { IpcRegistry } from './registry';
import type { StorageService } from '../services/storage';
import type { TaskGroupEngine } from '../services/task-group-engine';
import type { WebContents } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import type { FailurePolicy } from '@shared/types/task-group';

export function createTaskGroupIpcHandlers(
  registry: IpcRegistry,
  storage: StorageService,
  taskGroupEngine: TaskGroupEngine,
  webContents?: WebContents,
): void {
  if (registry.getHandler(IPC_CHANNELS.TASK_GROUP_CREATE)) return;

  registry.handle(IPC_CHANNELS.TASK_GROUP_CREATE, (_event: any, data: { name: string; failurePolicy: FailurePolicy }) => {
    const group = storage.createTaskGroup({ name: data.name, failurePolicy: data.failurePolicy });
    return { group };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_LIST, () => {
    const groups = storage.listTaskGroups();
    return { groups };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_GET, (_event: any, data: { taskGroupId: string }) => {
    const group = storage.getTaskGroup(data.taskGroupId);
    return { group };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_GET_ITEMS, (_event: any, data: { taskGroupId: string }) => {
    const items = storage.listTaskGroupItems(data.taskGroupId);
    return { items };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_ADD_ITEM, (_event: any, data: { taskGroupId: string; taskId: string; order: number }) => {
    const item = storage.addTaskGroupItem(data.taskGroupId, data.taskId, data.order);
    return { item };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_REMOVE_ITEM, (_event: any, data: { itemId: string }) => {
    storage.deleteTaskGroupItem(data.itemId);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_UPDATE, (_event: any, data: { taskGroupId: string; updates: Partial<{ name: string; failurePolicy: FailurePolicy; retryCount: number }> }) => {
    storage.updateTaskGroup(data.taskGroupId, data.updates);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_DELETE, (_event: any, data: { taskGroupId: string }) => {
    storage.deleteTaskGroup(data.taskGroupId);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_START, async (_event: any, data: { taskGroupId: string }) => {
    webContents?.send(IPC_CHANNELS.TASK_GROUP_STATUS_CHANGED, { taskGroupId: data.taskGroupId, status: 'running' });
    await taskGroupEngine.start(data.taskGroupId);
    webContents?.send(IPC_CHANNELS.TASK_GROUP_STATUS_CHANGED, { taskGroupId: data.taskGroupId, status: 'completed' });
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_STOP, (_event: any, data: { taskGroupId: string }) => {
    taskGroupEngine.stop(data.taskGroupId);
    webContents?.send(IPC_CHANNELS.TASK_GROUP_STATUS_CHANGED, { taskGroupId: data.taskGroupId, status: 'stopped' });
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_UPDATE_LOOP, (_event: any, data: { taskGroupId: string; loopEnabled: boolean; loopIntervalMs: number; loopMaxIterations: number }) => {
    storage.updateTaskGroupLoop(data.taskGroupId, {
      loopEnabled: data.loopEnabled,
      loopIntervalMs: data.loopIntervalMs,
      loopMaxIterations: data.loopMaxIterations,
    });
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_UPDATE_ITEM_TARGET, (_event: any, data: { itemId: string; onSuccess: string | null; onFailure: string | null }) => {
    storage.updateTaskGroupItemTarget(data.itemId, data.onSuccess, data.onFailure);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GROUP_REORDER_ITEMS, (_event: any, data: { taskGroupId: string; itemIds: string[] }) => {
    storage.reorderTaskGroupItems(data.taskGroupId, data.itemIds);
    return { success: true };
  });
}
