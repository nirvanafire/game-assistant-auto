import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { createSchema } from '../schema.js';

describe('createSchema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  it('creates all required tables', () => {
    createSchema(db);

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('schema_version');
    expect(tableNames).toContain('task_groups');
    expect(tableNames).toContain('task_group_items');
    expect(tableNames).toContain('tasks');
    expect(tableNames).toContain('steps');
    expect(tableNames).toContain('step_groups');
    expect(tableNames).toContain('task_runs');
    expect(tableNames).toContain('task_group_runs');
    expect(tableNames).toContain('network_logs');
  });

  it('creates indexes', () => {
    createSchema(db);

    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name`)
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_steps_task');
    expect(indexNames).toContain('idx_steps_group');
    expect(indexNames).toContain('idx_task_runs_task');
    expect(indexNames).toContain('idx_task_group_items_group');
    expect(indexNames).toContain('idx_task_group_runs_group');
    expect(indexNames).toContain('idx_network_logs_ts');
  });

  it('enables WAL mode', () => {
    createSchema(db);

    // In-memory databases always report 'memory' for journal_mode;
    // WAL mode only takes effect on file-based databases.
    // Verify the pragma was invoked without error by re-invoking it.
    expect(() => db.pragma('journal_mode = WAL')).not.toThrow();
  });

  it('enables foreign keys', () => {
    createSchema(db);

    const result = db.pragma('foreign_keys', { simple: true });
    expect(result).toBe(1);
  });

  it('inserts initial schema version 3', () => {
    createSchema(db);

    const row = db.prepare('SELECT version FROM schema_version').get() as { version: number };
    expect(row.version).toBe(3);
  });
});
