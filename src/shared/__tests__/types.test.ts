import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '../constants';

describe('IPC_CHANNELS', () => {
  it('has all task channels', () => {
    expect(IPC_CHANNELS.TASK_CREATE).toBe('task:create');
    expect(IPC_CHANNELS.TASK_UPDATE).toBe('task:update');
    expect(IPC_CHANNELS.TASK_START).toBe('task:start');
    expect(IPC_CHANNELS.TASK_PAUSE).toBe('task:pause');
    expect(IPC_CHANNELS.TASK_STOP).toBe('task:stop');
    expect(IPC_CHANNELS.TASK_DELETE).toBe('task:delete');
    expect(IPC_CHANNELS.TASK_STATUS_CHANGED).toBe('task:status-changed');
    expect(IPC_CHANNELS.TASK_STEP_RESULT).toBe('task:step-result');
    expect(IPC_CHANNELS.TASK_LOG).toBe('task:log');
  });

  it('has all task group channels', () => {
    expect(IPC_CHANNELS.TASK_GROUP_CREATE).toBe('task-group:create');
    expect(IPC_CHANNELS.TASK_GROUP_UPDATE).toBe('task-group:update');
    expect(IPC_CHANNELS.TASK_GROUP_START).toBe('task-group:start');
    expect(IPC_CHANNELS.TASK_GROUP_STOP).toBe('task-group:stop');
    expect(IPC_CHANNELS.TASK_GROUP_DELETE).toBe('task-group:delete');
    expect(IPC_CHANNELS.TASK_GROUP_STATUS_CHANGED).toBe('task-group:status-changed');
    expect(IPC_CHANNELS.TASK_GROUP_LOG).toBe('task-group:log');
  });

  it('has all log channels', () => {
    expect(IPC_CHANNELS.LOG_ENTRY).toBe('log:entry');
    expect(IPC_CHANNELS.LOG_DEBUG_STATE).toBe('log:debug-state');
    expect(IPC_CHANNELS.LOG_SET_DEBUG).toBe('log:set-debug');
    expect(IPC_CHANNELS.LOG_GET_LOGS).toBe('log:get-logs');
    expect(IPC_CHANNELS.LOG_EXPORT).toBe('log:export');
    expect(IPC_CHANNELS.LOG_CLEAR_DISPLAY).toBe('log:clear-display');
  });

  it('has network and capture channels', () => {
    expect(IPC_CHANNELS.NETWORK_REQUEST).toBe('network:request');
    expect(IPC_CHANNELS.NETWORK_START).toBe('network:start');
    expect(IPC_CHANNELS.NETWORK_STOP).toBe('network:stop');
    expect(IPC_CHANNELS.NETWORK_GET_LOGS).toBe('network:get-logs');
    expect(IPC_CHANNELS.CAPTURE_SCREENSHOT).toBe('capture:screenshot');
    expect(IPC_CHANNELS.CAPTURE_CLICK).toBe('capture:click');
    expect(IPC_CHANNELS.CAPTURE_UPDATED).toBe('capture:updated');
  });

  it('has 35 total channels', () => {
    expect(Object.keys(IPC_CHANNELS)).toHaveLength(35);
  });
});
