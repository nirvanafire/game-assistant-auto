import fs from 'fs';
import path from 'path';
import type { LogLevel, LogSource, LogEntry } from '@shared/types/log';

export class Logger {
  private logDir: string;
  private debugEnabled: boolean;
  private maxFileSize: number;
  private currentDate: string = '';
  private currentFileIndex: number = 0;
  private onLogEntry?: (entry: LogEntry) => void;

  constructor(logDir: string, debugEnabled: boolean, maxFileSize: number = 10 * 1024 * 1024) {
    this.logDir = logDir;
    this.debugEnabled = debugEnabled;
    this.maxFileSize = maxFileSize;
    fs.mkdirSync(logDir, { recursive: true });
  }

  setOnLogEntry(callback: (entry: LogEntry) => void): void {
    this.onLogEntry = callback;
  }

  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  isDebugEnabled(): boolean {
    return this.debugEnabled;
  }

  error(source: LogSource, message: string): void {
    this.log('ERROR', source, message);
  }

  warn(source: LogSource, message: string): void {
    this.log('WARN', source, message);
  }

  info(source: LogSource, message: string): void {
    this.log('INFO', source, message);
  }

  debug(source: LogSource, message: string): void {
    if (!this.debugEnabled) return;
    this.log('DEBUG', source, message);
  }

  private log(level: LogLevel, source: LogSource, message: string): void {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 23);
    const line = `[${timestamp}] [${level}] [${source}] ${message}\n`;

    const filePath = this.ensureFile(now);
    fs.appendFileSync(filePath, line);
    this.checkRotation();

    try {
      this.onLogEntry?.({ timestamp: now.toISOString(), level, source, message });
    } catch {
      // Callback errors must not crash the logger
    }
  }

  private ensureFile(now: Date): string {
    const dateStr = now.toISOString().substring(0, 10);

    if (dateStr !== this.currentDate) {
      this.currentDate = dateStr;
      this.currentFileIndex = 0;
    }

    return this.getCurrentPath();
  }

  private checkRotation(): void {
    const currentPath = this.getCurrentPath();
    if (fs.existsSync(currentPath)) {
      const stats = fs.statSync(currentPath);
      if (stats.size >= this.maxFileSize) {
        this.currentFileIndex++;
        const fd = fs.openSync(this.getCurrentPath(), 'a');
        fs.closeSync(fd);
      }
    }
  }

  private getCurrentPath(): string {
    const suffix = this.currentFileIndex === 0 ? '' : `.${this.currentFileIndex}`;
    return path.join(this.logDir, `game-assistant-${this.currentDate}${suffix}.log`);
  }

  cleanup(maxAgeDays: number): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    const files = fs.readdirSync(this.logDir);
    for (const file of files) {
      const match = file.match(/game-assistant-(\d{4}-\d{2}-\d{2})/);
      if (match) {
        const fileDate = new Date(match[1] + 'T00:00:00');
        if (fileDate < cutoff) {
          try {
            fs.unlinkSync(path.join(this.logDir, file));
          } catch {
            // File may be locked by another process on Windows
          }
        }
      }
    }
  }

  destroy(): void {
    // No-op for synchronous append mode
  }
}
