import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, getCurrentVersion } from '../migrations';

function createV3Schema(db: Database.Database): void {
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
      loop_enabled INTEGER DEFAULT 0,
      loop_interval_ms INTEGER DEFAULT 0,
      loop_max_iterations INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_group_items (
      id TEXT PRIMARY KEY,
      task_group_id TEXT NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL,
      on_success TEXT DEFAULT NULL,
      on_failure TEXT DEFAULT NULL
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
      type TEXT NOT NULL CHECK(type IN ('IMAGE_MATCH','IMAGE_GROUP','CLICK')),
      "order" INTEGER NOT NULL,
      group_id TEXT REFERENCES step_groups(id) ON DELETE SET NULL,
      config JSON NOT NULL,
      on_match JSON NOT NULL DEFAULT '{}',
      on_miss JSON NOT NULL DEFAULT '{}',
      screenshot_before_match INTEGER DEFAULT 0,
      realtime_match INTEGER DEFAULT 0,
      cache_coordinates INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS step_groups (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      loop_count INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS task_runs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      result TEXT CHECK(result IN ('completed','failed','stopped')),
      log JSON DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS task_group_runs (
      id TEXT PRIMARY KEY,
      task_group_id TEXT NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      result TEXT CHECK(result IN ('completed','failed','stopped')),
      log JSON DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS network_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      method TEXT,
      url TEXT NOT NULL,
      status_code INTEGER,
      request_headers JSON,
      request_body TEXT,
      response_headers JSON,
      response_body TEXT,
      response_body_path TEXT,
      duration_ms INTEGER,
      resource_type TEXT,
      size INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_steps_task ON steps(task_id);
    CREATE INDEX IF NOT EXISTS idx_steps_group ON steps(group_id);
    CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_group_items_group ON task_group_items(task_group_id);
    CREATE INDEX IF NOT EXISTS idx_task_group_runs_group ON task_group_runs(task_group_id);
    CREATE INDEX IF NOT EXISTS idx_network_logs_ts ON network_logs(timestamp);

    INSERT OR IGNORE INTO schema_version (version) VALUES (3);
  `);
}

describe('Migration v4', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createV3Schema(db);
  });

  it('backfills empty on_match for IMAGE_MATCH to NEXT_STEP', () => {
    db.prepare("INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)").run('t1', 'Test', 'idle', '{}', '[]');
    db.prepare('INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('s1', 't1', 'IMAGE_MATCH', 1, '{}', '{}', '{}', 0, 0, 0);
    runMigrations(db);
    const row = db.prepare('SELECT on_match FROM steps WHERE id = ?').get('s1') as any;
    expect(JSON.parse(row.on_match)).toEqual({ action: 'NEXT_STEP' });
  });

  it('backfills empty on_miss for IMAGE_GROUP to NEXT_STEP', () => {
    db.prepare("INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)").run('t1', 'Test', 'idle', '{}', '[]');
    db.prepare('INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('s1', 't1', 'IMAGE_GROUP', 1, '{}', '{}', '{}', 0, 0, 0);
    runMigrations(db);
    const row = db.prepare('SELECT on_miss FROM steps WHERE id = ?').get('s1') as any;
    expect(JSON.parse(row.on_miss)).toEqual({ action: 'NEXT_STEP' });
  });

  it('does not modify CLICK rows', () => {
    db.prepare("INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)").run('t1', 'Test', 'idle', '{}', '[]');
    db.prepare('INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('s1', 't1', 'CLICK', 1, '{}', '{}', '{}', 0, 0, 0);
    runMigrations(db);
    const row = db.prepare('SELECT on_match FROM steps WHERE id = ?').get('s1') as any;
    expect(row.on_match).toBe('{}');
  });

  it('does not modify rows with existing action', () => {
    db.prepare("INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)").run('t1', 'Test', 'idle', '{}', '[]');
    db.prepare('INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('s1', 't1', 'IMAGE_MATCH', 1, '{}', '{"action":"END_TASK"}', '{}', 0, 0, 0);
    runMigrations(db);
    const row = db.prepare('SELECT on_match FROM steps WHERE id = ?').get('s1') as any;
    expect(JSON.parse(row.on_match)).toEqual({ action: 'END_TASK' });
  });

  it('does not modify rows with nextStepId', () => {
    db.prepare("INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)").run('t1', 'Test', 'idle', '{}', '[]');
    db.prepare('INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match, realtime_match, cache_coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('s1', 't1', 'IMAGE_MATCH', 1, '{}', '{"nextStepId":"s3"}', '{}', 0, 0, 0);
    runMigrations(db);
    const row = db.prepare('SELECT on_match FROM steps WHERE id = ?').get('s1') as any;
    expect(JSON.parse(row.on_match)).toEqual({ nextStepId: 's3' });
  });

  it('updates schema version to 4', () => {
    runMigrations(db);
    expect(getCurrentVersion(db)).toBe(4);
  });
});
