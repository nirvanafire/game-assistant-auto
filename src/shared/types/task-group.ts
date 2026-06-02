export type FailurePolicy = 'stop' | 'continue' | 'skip';

export interface TaskGroupItemRun {
  taskRunId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface TaskGroupRun {
  id: string;
  taskGroupId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  items: TaskGroupItemRun[];
  startedAt?: number;
  completedAt?: number;
  currentIteration: number;
}

export interface TaskGroupItem {
  taskId: string;
  order: number;
  onFailure?: FailurePolicy;
  retryCount?: number;
}

export interface TaskGroup {
  id: string;
  name: string;
  description?: string;
  items: TaskGroupItem[];
  loopCount?: number;
  loopDelay?: number;
  onFailure?: FailurePolicy;
  createdAt: number;
  updatedAt: number;
}
