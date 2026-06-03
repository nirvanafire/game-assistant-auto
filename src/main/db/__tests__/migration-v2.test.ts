import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations, getCurrentVersion } from '../migrations';

function createV1Schema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      failure_policy TEXT DEFAULT 'STOP' CHECK(failure_policy IN ('STOP','SKIP','RETRY')),
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_group_items (
      id TEXT PRIMARY KEY,
      task_group_id TEXT NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'idle' CHECK(status IN ('idle','running','paused','completed','failed','stopped')),
      settings JSON NOT NULL DEFAULT '{}',
      interrupt_handlers JSON NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      config JSON NOT NULL,
      on_match JSON NOT NULL DEFAULT '{}',
      on_miss JSON NOT NULL DEFAULT '{}',
      screenshot_before_match INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO schema_version (version) VALUES (1);
  `);
}

describe('migration v2: loop and jump target fields', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createV1Schema(db);
  });

  it('adds loop columns to task_groups', () => {
    runMigrations(db);
    const columns = db.prepare("PRAGMA table_info(task_groups)").all() as any[];
    const names = columns.map((c: any) => c.name);
    expect(names).toContain('loop_enabled');
    expect(names).toContain('loop_interval_ms');
    expect(names).toContain('loop_max_iterations');
  });

  it('adds jump target columns to task_group_items', () => {
    runMigrations(db);
    const columns = db.prepare("PRAGMA table_info(task_group_items)").all() as any[];
    const names = columns.map((c: any) => c.name);
    expect(names).toContain('on_success');
    expect(names).toContain('on_failure');
  });

  it('sets default values for loop fields', () => {
    runMigrations(db);
    db.prepare("INSERT INTO task_groups (id, name) VALUES ('test', 'Test')").run();
    const group = db.prepare("SELECT * FROM task_groups WHERE id = 'test'").get() as any;
    expect(group.loop_enabled).toBe(0);
    expect(group.loop_interval_ms).toBe(0);
    expect(group.loop_max_iterations).toBe(0);
  });

  it('sets default NULL for jump targets', () => {
    runMigrations(db);
    db.prepare("INSERT INTO task_groups (id, name) VALUES ('g1', 'G')").run();
    db.prepare("INSERT INTO tasks (id, name) VALUES ('t1', 'T')").run();
    db.prepare('INSERT INTO task_group_items (id, task_group_id, task_id, "order") VALUES (\'i1\', \'g1\', \'t1\', 0)').run();
    const item = db.prepare("SELECT * FROM task_group_items WHERE id = 'i1'").get() as any;
    expect(item.on_success).toBeNull();
    expect(item.on_failure).toBeNull();
  });

  it('updates schema version past 2', () => {
    runMigrations(db);
    expect(getCurrentVersion(db)).toBeGreaterThanOrEqual(2);
  });
});
