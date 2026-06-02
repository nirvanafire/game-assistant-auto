import type { FailurePolicy, TaskGroupItem } from '@shared/types/task-group';
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

    const itemMap = new Map<string, TaskGroupItem>();
    for (const item of items) {
      itemMap.set(item.id, item);
    }

    let iteration = 0;
    while (this.shouldContinue(group.loopEnabled, group.loopMaxIterations, iteration, taskGroupId)) {
      await this.runGroupOnce(items, itemMap, group.failurePolicy, group.retryCount, taskGroupId, runLog);

      iteration++;
      if (group.loopEnabled && this.shouldContinue(group.loopEnabled, group.loopMaxIterations, iteration, taskGroupId)) {
        await this.delay(group.loopIntervalMs, taskGroupId);
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

  private shouldContinue(
    loopEnabled: boolean,
    loopMaxIterations: number,
    iteration: number,
    taskGroupId: string,
  ): boolean {
    if (this.running.get(taskGroupId) === false) return false;
    if (!loopEnabled) return iteration === 0;
    if (loopMaxIterations === 0) return true; // infinite
    return iteration < loopMaxIterations;
  }

  private async runGroupOnce(
    items: TaskGroupItem[],
    itemMap: Map<string, TaskGroupItem>,
    failurePolicy: FailurePolicy,
    retryCount: number,
    taskGroupId: string,
    runLog: any[],
  ): Promise<void> {
    if (items.length === 0) return;

    let currentItem: TaskGroupItem | undefined = items[0];
    let maxJumps = items.length * 2; // prevent infinite loops from circular jumps

    while (currentItem && this.running.get(taskGroupId) !== false && maxJumps > 0) {
      maxJumps--;
      const success = await this.executeTask(currentItem.taskId, failurePolicy, retryCount);

      runLog.push({
        taskId: currentItem.taskId,
        success,
        timestamp: new Date().toISOString(),
      });

      const jumpTarget = success
        ? currentItem.onSuccess
        : currentItem.onFailure;

      if (jumpTarget === 'END') {
        break;
      } else if (jumpTarget == null) {
        if (success) {
          const currentIndex = items.indexOf(currentItem);
          currentItem = items[currentIndex + 1];
        } else {
          if (failurePolicy === 'SKIP') {
            const currentIndex = items.indexOf(currentItem);
            currentItem = items[currentIndex + 1];
          } else {
            break; // STOP or RETRY (already retried in executeTask)
          }
        }
      } else {
        currentItem = itemMap.get(jumpTarget);
      }
    }
  }

  private async executeTask(
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

  private async delay(ms: number, groupId: string): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        clearInterval(check);
        resolve();
      }, ms);
      const check = setInterval(() => {
        if (!this.running.get(groupId)) {
          clearTimeout(timer);
          clearInterval(check);
          resolve();
        }
      }, 200);
    });
  }
}
