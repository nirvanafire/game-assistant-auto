import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createImportExportHandlers } from '../import-export';

describe('Import/Export IPC Handlers', () => {
  let registry: any;
  let mockStorage: any;

  beforeEach(() => {
    registry = { handle: vi.fn(), getHandler: vi.fn().mockReturnValue(undefined) };
    mockStorage = {
      getTask: vi.fn().mockReturnValue({ id: 't1', name: 'Test', status: 'idle', settings: {}, interruptHandlers: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' }),
      listSteps: vi.fn().mockReturnValue([
        { id: 's1', taskId: 't1', type: 'IMAGE_MATCH', order: 1, config: { templatePath: '/img.png', threshold: 0.8 }, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true },
      ]),
      getTaskGroup: vi.fn().mockReturnValue({ id: 'g1', name: 'Group', failurePolicy: 'STOP', retryCount: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' }),
      listTaskGroups: vi.fn().mockReturnValue([]),
      listTaskGroupItems: vi.fn().mockReturnValue([
        { id: 'i1', taskGroupId: 'g1', taskId: 't1', order: 1 },
      ]),
      createTask: vi.fn().mockReturnValue({ id: 'new-t1', name: 'Test' }),
      createStep: vi.fn(),
      createTaskGroup: vi.fn().mockReturnValue({ id: 'new-g1', name: 'Group' }),
      addTaskGroupItem: vi.fn(),
    };
  });

  it('registers export and import handlers', () => {
    createImportExportHandlers(registry, mockStorage);
    expect(registry.handle).toHaveBeenCalledWith('import-export:export', expect.any(Function));
    expect(registry.handle).toHaveBeenCalledWith('import-export:import', expect.any(Function));
  });

  it('exports tasks with steps', () => {
    createImportExportHandlers(registry, mockStorage);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === 'import-export:export')[1];
    const result = handler({}, { taskIds: ['t1'] });
    expect(result.data.tasks).toHaveLength(1);
    expect(result.data.tasks[0].name).toBe('Test');
    expect(result.data.tasks[0].steps).toHaveLength(1);
  });

  it('exports task groups with items', () => {
    createImportExportHandlers(registry, mockStorage);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === 'import-export:export')[1];
    const result = handler({}, { taskIds: [], groupIds: ['g1'] });
    expect(result.data.groups).toHaveLength(1);
    expect(result.data.groups[0].items).toHaveLength(1);
  });

  it('imports tasks from JSON', () => {
    createImportExportHandlers(registry, mockStorage);
    const handler = registry.handle.mock.calls.find((c: any) => c[0] === 'import-export:import')[1];
    const json = JSON.stringify({
      version: 1,
      tasks: [{ id: 'old-t1', name: 'Imported', status: 'idle', settings: {}, interruptHandlers: [], steps: [{ type: 'IMAGE_MATCH', order: 1, config: {}, onMatch: { action: 'END_TASK' }, onMiss: { action: 'END_TASK' }, screenshotBeforeMatch: true }] }],
      groups: [],
    });
    const result = handler({}, { json });
    expect(result.success).toBe(true);
    expect(mockStorage.createTask).toHaveBeenCalledWith({ name: 'Imported', settings: {}, interruptHandlers: [] });
    expect(mockStorage.createStep).toHaveBeenCalled();
  });

  it('does not register duplicate handlers', () => {
    registry.getHandler = vi.fn().mockReturnValue(() => {});
    createImportExportHandlers(registry, mockStorage);
    expect(registry.handle).not.toHaveBeenCalled();
  });
});
