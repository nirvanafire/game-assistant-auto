export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export type LogSource = 'TaskEngine' | 'Matcher' | 'Clicker' | 'Network' | 'Python' | 'Storage' | 'App';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
}
