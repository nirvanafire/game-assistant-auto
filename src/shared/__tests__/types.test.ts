import { describe, it, expect } from 'vitest';
import type { Task, Step, StepGroup, StepTransition, ImageMatchConfig, ClickConfig, ImageGroupMatchConfig } from '../types/task';
import type { TaskGroup, TaskGroupItem } from '../types/task-group';
import type { LogEntry, LogLevel, LogSource } from '../types/log';
import type { MatchResult } from '../types/match-result';
import { IPC_CHANNELS } from '../constants';

describe('shared types', () => {
  it('exports IPC channel constants', () => {
    expect(IPC_CHANNELS.TASK_CREATE).toBe('task:create');
    expect(IPC_CHANNELS.LOG_ENTRY).toBe('log:entry');
    expect(IPC_CHANNELS.TASK_GROUP_CREATE).toBe('task-group:create');
  });
});
