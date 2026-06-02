import type { FailurePolicy } from '@shared/types/task-group';
import type { StorageService } from './storage';
import type { TaskEngine } from './task-engine';

export class TaskGroupEngine {
  private storage: StorageService;
  private taskEngine: TaskEngine;
  private running = new Map<string, boolean>();

  constructor(storage: StorageService, taskEngine: TaskEngine) {
    this.storage = storage;
    this.taskEngine = taskEngine;
  }

  async start(taskGroupId: string): Promise<void> {
    const group = this.storage.getTaskGroup(taskGroupId);
    if (!group) throw new Error(`Task group not found: ${taskGroupId}`);

    const items = this.storage.listTaskGroupItems(taskGroupId);
    const runId = this.storage.createTaskGroupRun({ taskGroupId });
    const runLog: any[] = [];
    this.running.set(taskGroupId, true);

    for (const item of items) {
      if (!this.running.get(taskGroupId)) break;

      const success = await this.executeWithPolicy(
        item.taskId,
        group.failurePolicy,
        group.retryCount,
      );

      runLog.push({
        taskId: item.taskId,
        success,
        timestamp: new Date().toISOString(),
      });

      if (!success && group.failurePolicy === 'STOP') {
        break;
      }
    }

    const result = this.running.get(taskGroupId) === false ? 'stopped' : 'completed';
    this.storage.updateTaskGroupRun(runId, {
      endedAt: new Date().toISOString(),
      result,
      log: runLog,
    });

    this.running.delete(taskGroupId);
  }

  stop(taskGroupId: string): void {
    this.running.set(taskGroupId, false);
  }

  private async executeWithPolicy(
    taskId: string,
    policy: FailurePolicy,
    retryCount: number,
  ): Promise<boolean> {
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      await this.taskEngine.start(taskId);
      const status = this.taskEngine.getStatus(taskId);

      if (status === 'completed') return true;
      if (status === 'stopped') return false;

      if (status === 'failed') {
        if (policy === 'RETRY' && attempt < retryCount) {
          continue;
        }
        return policy === 'SKIP';
      }
    }
    return false;
  }
}
