import type { IpcRegistry } from './registry';
import type { StorageService } from '../services/storage';
import { IPC_CHANNELS } from '@shared/constants';

export function createImportExportHandlers(
  registry: IpcRegistry,
  storage: StorageService,
): void {
  if (registry.getHandler(IPC_CHANNELS.IMPORT_EXPORT_EXPORT)) return;

  registry.handle(IPC_CHANNELS.IMPORT_EXPORT_EXPORT, (_event: any, data: { taskIds?: string[]; groupIds?: string[] }) => {
    const tasks = (data.taskIds || []).map(id => {
      const task = storage.getTask(id);
      if (!task) return null;
      const steps = storage.listSteps(id);
      return { ...task, steps };
    }).filter(Boolean);

    const groups = (data.groupIds || []).map(id => {
      const group = storage.getTaskGroup(id);
      if (!group) return null;
      const items = storage.listTaskGroupItems(id);
      return { ...group, items };
    }).filter(Boolean);

    return { data: { version: 1, tasks, groups } };
  });

  registry.handle(IPC_CHANNELS.IMPORT_EXPORT_IMPORT, (_event: any, data: { json: string }) => {
    let parsed: any;
    try {
      parsed = JSON.parse(data.json);
    } catch {
      return { success: false, error: 'Invalid JSON' };
    }

    const taskMap = new Map<string, string>();

    for (const task of parsed.tasks || []) {
      const newTask = storage.createTask({ name: task.name, settings: task.settings, interruptHandlers: task.interruptHandlers });
      taskMap.set(task.id, newTask.id);
      for (const step of task.steps || []) {
        const newStep = { ...step, taskId: newTask.id };
        delete (newStep as any).id;
        storage.createStep(newStep);
      }
    }

    for (const group of parsed.groups || []) {
      const failurePolicy = group.failurePolicy ?? 'STOP';
      const newGroup = storage.createTaskGroup({ name: group.name, failurePolicy });
      for (const item of group.items || []) {
        const newTaskId = taskMap.get(item.taskId);
        if (newTaskId) {
          storage.addTaskGroupItem(newGroup.id, newTaskId, item.order);
        }
      }
    }

    return { success: true };
  });
}
