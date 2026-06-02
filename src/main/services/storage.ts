import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Task, Step, TaskSettings, InterruptHandler } from '@shared/types/task';
import type { TaskGroup, TaskGroupItem, FailurePolicy } from '@shared/types/task-group';

export class StorageService {
  constructor(private db: Database.Database) {}

  createTask(data: { name: string; settings?: TaskSettings; interruptHandlers?: InterruptHandler[] }): Task {
    const id = uuidv4();
    const now = new Date().toISOString();
    const settings = data.settings ?? {};
    const interruptHandlers = data.interruptHandlers ?? [];
    this.db.prepare(
      'INSERT INTO tasks (id, name, status, settings, interrupt_handlers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, data.name, 'idle', JSON.stringify(settings), JSON.stringify(interruptHandlers), now, now);
    return { id, name: data.name, status: 'idle', settings, interruptHandlers, createdAt: now, updatedAt: now };
  }

  getTask(id: string): Task | undefined {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      settings: JSON.parse(row.settings),
      interruptHandlers: JSON.parse(row.interrupt_handlers),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listTasks(): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      settings: JSON.parse(row.settings),
      interruptHandlers: JSON.parse(row.interrupt_handlers),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  updateTask(id: string, data: Partial<{ name: string; status: string; settings: TaskSettings; interruptHandlers: InterruptHandler[] }>): void {
    const now = new Date().toISOString();
    const updates: Array<[string, any[]]> = [];
    if (data.name !== undefined) {
      updates.push(['UPDATE tasks SET name = ?, updated_at = ? WHERE id = ?', [data.name, now, id]]);
    }
    if (data.status !== undefined) {
      updates.push(['UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', [data.status, now, id]]);
    }
    if (data.settings !== undefined) {
      updates.push(['UPDATE tasks SET settings = ?, updated_at = ? WHERE id = ?', [JSON.stringify(data.settings), now, id]]);
    }
    if (data.interruptHandlers !== undefined) {
      updates.push(['UPDATE tasks SET interrupt_handlers = ?, updated_at = ? WHERE id = ?', [JSON.stringify(data.interruptHandlers), now, id]]);
    }
    if (updates.length === 0) return;
    const runAll = this.db.transaction(() => {
      for (const [sql, params] of updates) {
        this.db.prepare(sql).run(...params);
      }
    });
    runAll();
  }

  deleteTask(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }

  createStep(data: Omit<Step, 'id'>): Step {
    const id = uuidv4();
    this.db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", group_id, config, on_match, on_miss, screenshot_before_match) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, data.taskId, data.type, data.order, data.groupId ?? null, JSON.stringify(data.config), JSON.stringify(data.onMatch), JSON.stringify(data.onMiss), data.screenshotBeforeMatch ? 1 : 0);
    return { ...data, id };
  }

  listSteps(taskId: string): Step[] {
    const rows = this.db.prepare('SELECT * FROM steps WHERE task_id = ? ORDER BY "order"').all(taskId) as any[];
    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      type: row.type,
      order: row.order,
      groupId: row.group_id,
      config: JSON.parse(row.config),
      onMatch: JSON.parse(row.on_match),
      onMiss: JSON.parse(row.on_miss),
      screenshotBeforeMatch: row.screenshot_before_match === 1,
    }));
  }

  createTaskGroup(data: { name: string; failurePolicy: FailurePolicy; retryCount?: number }): TaskGroup {
    const id = uuidv4();
    const now = new Date().toISOString();
    const retryCount = data.retryCount ?? 0;
    this.db.prepare(
      'INSERT INTO task_groups (id, name, failure_policy, retry_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, data.name, data.failurePolicy, retryCount, now, now);
    return { id, name: data.name, failurePolicy: data.failurePolicy, retryCount, createdAt: now, updatedAt: now };
  }

  getTaskGroup(id: string): TaskGroup | undefined {
    const row = this.db.prepare('SELECT * FROM task_groups WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return { id: row.id, name: row.name, failurePolicy: row.failure_policy, retryCount: row.retry_count, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  listTaskGroups(): TaskGroup[] {
    const rows = this.db.prepare('SELECT * FROM task_groups ORDER BY created_at DESC').all() as any[];
    return rows.map(row => ({ id: row.id, name: row.name, failurePolicy: row.failure_policy, retryCount: row.retry_count, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  addTaskGroupItem(taskGroupId: string, taskId: string, order: number): TaskGroupItem {
    const id = uuidv4();
    this.db.prepare('INSERT INTO task_group_items (id, task_group_id, task_id, "order") VALUES (?, ?, ?, ?)').run(id, taskGroupId, taskId, order);
    return { id, taskGroupId, taskId, order };
  }

  listTaskGroupItems(taskGroupId: string): TaskGroupItem[] {
    const rows = this.db.prepare('SELECT * FROM task_group_items WHERE task_group_id = ? ORDER BY "order"').all(taskGroupId) as any[];
    return rows.map(row => ({ id: row.id, taskGroupId: row.task_group_id, taskId: row.task_id, order: row.order }));
  }

  deleteTaskGroupItem(id: string): void {
    this.db.prepare('DELETE FROM task_group_items WHERE id = ?').run(id);
  }

  deleteTaskGroup(id: string): void {
    this.db.prepare('DELETE FROM task_groups WHERE id = ?').run(id);
  }
}
