import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../../db/schema.js';
import { StorageService } from '../storage.js';

describe('StorageService', () => {
  let db: Database.Database;
  let storage: StorageService;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    storage = new StorageService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('tasks', () => {
    it('creates a task', () => {
      const task = storage.createTask({ name: 'Test Task' });
      expect(task.id).toBeDefined();
      expect(task.name).toBe('Test Task');
      expect(task.status).toBe('idle');
    });

    it('gets a task by id', () => {
      const created = storage.createTask({ name: 'Test Task' });
      const found = storage.getTask(created.id);
      expect(found?.name).toBe('Test Task');
    });

    it('lists all tasks', () => {
      storage.createTask({ name: 'Task A' });
      storage.createTask({ name: 'Task B' });
      const tasks = storage.listTasks();
      expect(tasks).toHaveLength(2);
    });

    it('updates a task', () => {
      const task = storage.createTask({ name: 'Old Name' });
      storage.updateTask(task.id, { name: 'New Name' });
      const updated = storage.getTask(task.id);
      expect(updated?.name).toBe('New Name');
    });

    it('deletes a task', () => {
      const task = storage.createTask({ name: 'To Delete' });
      storage.deleteTask(task.id);
      expect(storage.getTask(task.id)).toBeUndefined();
    });
  });

  describe('steps', () => {
    it('creates a step', () => {
      const task = storage.createTask({ name: 'Task' });
      const step = storage.createStep({
        taskId: task.id,
        type: 'IMAGE_MATCH',
        order: 1,
        config: { templatePath: '/path/to/img.png', threshold: 0.8, delayMs: 0, retryCount: 3, retryIntervalMs: 1000, scaleRange: [0.5, 2.0] },
        onMatch: {},
        onMiss: {},
        screenshotBeforeMatch: false,
      });
      expect(step.id).toBeDefined();
      expect(step.type).toBe('IMAGE_MATCH');
    });

    it('lists steps for a task', () => {
      const task = storage.createTask({ name: 'Task' });
      storage.createStep({ taskId: task.id, type: 'IMAGE_MATCH', order: 1, config: { templatePath: '', threshold: 0.8, delayMs: 0, retryCount: 0, retryIntervalMs: 0, scaleRange: [0.5, 2] }, onMatch: {}, onMiss: {}, screenshotBeforeMatch: false });
      storage.createStep({ taskId: task.id, type: 'CLICK', order: 2, config: { source: 'fixed', fixedCoords: { x: 100, y: 200 }, clickCount: 1, intervalMs: 0, delayMs: 0, button: 'left' }, onMatch: {}, onMiss: {}, screenshotBeforeMatch: false });
      const steps = storage.listSteps(task.id);
      expect(steps).toHaveLength(2);
    });
  });

  describe('task groups', () => {
    it('creates a task group', () => {
      const group = storage.createTaskGroup({ name: 'Daily Tasks', failurePolicy: 'STOP' });
      expect(group.id).toBeDefined();
      expect(group.name).toBe('Daily Tasks');
      expect(group.failurePolicy).toBe('STOP');
    });

    it('adds items to a task group', () => {
      const task = storage.createTask({ name: 'Task A' });
      const group = storage.createTaskGroup({ name: 'Group', failurePolicy: 'STOP' });
      storage.addTaskGroupItem(group.id, task.id, 1);
      const items = storage.listTaskGroupItems(group.id);
      expect(items).toHaveLength(1);
      expect(items[0].taskId).toBe(task.id);
    });

    it('allows same task multiple times in a group', () => {
      const task = storage.createTask({ name: 'Task A' });
      const group = storage.createTaskGroup({ name: 'Group', failurePolicy: 'STOP' });
      storage.addTaskGroupItem(group.id, task.id, 1);
      storage.addTaskGroupItem(group.id, task.id, 2);
      const items = storage.listTaskGroupItems(group.id);
      expect(items).toHaveLength(2);
    });
  });
});
