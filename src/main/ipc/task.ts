import type { IpcRegistry } from './registry';
import type { StorageService } from '../services/storage';
import type { TaskEngine } from '../services/task-engine';
import type { WebContents } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';

export function createTaskIpcHandlers(
  registry: IpcRegistry,
  storage: StorageService,
  taskEngine: TaskEngine,
  webContents: WebContents,
): void {
  if (registry.getHandler(IPC_CHANNELS.TASK_CREATE)) return;

  registry.handle(IPC_CHANNELS.TASK_CREATE, (_event: any, data: { name: string }) => {
    const task = storage.createTask({ name: data.name });
    return { task };
  });

  registry.handle(IPC_CHANNELS.TASK_GET, (_event: any, data: { taskId: string }) => {
    const task = storage.getTask(data.taskId);
    return { task };
  });

  registry.handle(IPC_CHANNELS.TASK_UPDATE, (_event: any, data: { taskId: string; updates: any }) => {
    storage.updateTask(data.taskId, data.updates);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_START, async (_event: any, data: { taskId: string }) => {
    await taskEngine.start(data.taskId);
    webContents.send(IPC_CHANNELS.TASK_STATUS_CHANGED, { taskId: data.taskId, status: 'running' });
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_STOP, (_event: any, data: { taskId: string }) => {
    taskEngine.stop(data.taskId);
    webContents.send(IPC_CHANNELS.TASK_STATUS_CHANGED, { taskId: data.taskId, status: 'stopped' });
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_DELETE, (_event: any, data: { taskId: string }) => {
    storage.deleteTask(data.taskId);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_GET_STEPS, (_event: any, data: { taskId: string }) => {
    const steps = storage.listSteps(data.taskId);
    return { steps };
  });

  registry.handle(IPC_CHANNELS.TASK_CREATE_STEP, (_event: any, data: { step: any }) => {
    const step = storage.createStep(data.step);
    return { step };
  });

  registry.handle(IPC_CHANNELS.TASK_UPDATE_STEP, (_event: any, data: { stepId: string; updates: any }) => {
    storage.updateStep(data.stepId, data.updates);
    return { success: true };
  });

  registry.handle(IPC_CHANNELS.TASK_DELETE_STEP, (_event: any, data: { stepId: string }) => {
    storage.deleteStep(data.stepId);
    return { success: true };
  });
}
