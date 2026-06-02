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

  it('has browser channels', () => {
    expect(IPC_CHANNELS.BROWSER_LOAD_URL).toBe('browser:load-url');
    expect(IPC_CHANNELS.BROWSER_GET_URL).toBe('browser:get-url');
    expect(IPC_CHANNELS.BROWSER_SET_BOUNDS).toBe('browser:set-bounds');
    expect(IPC_CHANNELS.BROWSER_GO_BACK).toBe('browser:go-back');
    expect(IPC_CHANNELS.BROWSER_GO_FORWARD).toBe('browser:go-forward');
    expect(IPC_CHANNELS.BROWSER_RELOAD).toBe('browser:reload');
    expect(IPC_CHANNELS.BROWSER_LOADING_STATE).toBe('browser:loading-state');
  });

  it('has 53 total channels', () => {
    expect(Object.keys(IPC_CHANNELS)).toHaveLength(53);
  });

  it('has new IPC channels for loop and jump-target', () => {
    expect(IPC_CHANNELS.TASK_GROUP_UPDATE_LOOP).toBe('task-group:update-loop');
    expect(IPC_CHANNELS.TASK_GROUP_UPDATE_ITEM_TARGET).toBe('task-group:update-item-target');
    expect(IPC_CHANNELS.TASK_GROUP_REORDER_ITEMS).toBe('task-group:reorder-items');
  });
});

describe('TaskGroup type', () => {
  it('has loop fields', () => {
    const group: import('../types/task-group').TaskGroup = {
      id: '1', name: 'G', failurePolicy: 'STOP', retryCount: 0,
      loopEnabled: true, loopIntervalMs: 60000, loopMaxIterations: 5,
      createdAt: '', updatedAt: '',
    };
    expect(group.loopEnabled).toBe(true);
    expect(group.loopIntervalMs).toBe(60000);
    expect(group.loopMaxIterations).toBe(5);
  });
});

describe('TaskGroupItem type', () => {
  it('has jump target fields', () => {
    const item: import('../types/task-group').TaskGroupItem = {
      id: '1', taskGroupId: 'g', taskId: 't', order: 0,
      onSuccess: 'item-2', onFailure: 'END',
    };
    expect(item.onSuccess).toBe('item-2');
    expect(item.onFailure).toBe('END');
  });
});
