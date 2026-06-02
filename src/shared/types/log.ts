export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogSource = 'main' | 'renderer' | 'task-engine' | 'matcher' | 'capture';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: LogSource;
  message: string;
  data?: unknown;
  taskId?: string;
  taskGroupId?: string;
  stepId?: string;
}
