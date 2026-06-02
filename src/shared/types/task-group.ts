export type FailurePolicy = 'STOP' | 'SKIP' | 'RETRY';

export interface TaskGroup {
  id: string;
  name: string;
  failurePolicy: FailurePolicy;
  retryCount: number;
  loopEnabled: boolean;
  loopIntervalMs: number;
  loopMaxIterations: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskGroupItem {
  id: string;
  taskGroupId: string;
  taskId: string;
  order: number;
  onSuccess: string | null;
  onFailure: string | null;
}

export interface TaskGroupItemRun {
  itemOrder: number;
  taskId: string;
  result?: 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  endedAt?: string;
  taskRunId?: string;
}

export interface TaskGroupRun {
  id: string;
  taskGroupId: string;
  startedAt: string;
  endedAt?: string;
  result?: 'completed' | 'failed' | 'stopped';
  items: TaskGroupItemRun[];
}
