import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, getCurrentVersion } from '../migrations';

function createV2Schema(db: Database.Database): void {
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
      screenshot_before_match INTEGER DEFAULT 0
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

    INSERT OR IGNORE INTO schema_version (version) VALUES (2);
  `);
}

describe('Migration v3', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createV2Schema(db);
  });

  it('adds realtime_match and cache_coordinates columns to steps table', () => {
    runMigrations(db);
    const columns = db.prepare("PRAGMA table_info(steps)").all() as any[];
    const colNames = columns.map((c: any) => c.name);
    expect(colNames).toContain('realtime_match');
    expect(colNames).toContain('cache_coordinates');
  });

  it('sets realtime_match from task settings.screenshotBeforeMatch', () => {
    const taskId = 'task-1';
    db.prepare(
      "INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)"
    ).run(taskId, 'Test', 'idle', JSON.stringify({ screenshotBeforeMatch: true }), '[]');

    db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('step-1', taskId, 'IMAGE_MATCH', 1, '{}', '{}', '{}', 0);

    runMigrations(db);

    const step = db.prepare('SELECT realtime_match FROM steps WHERE id = ?').get('step-1') as any;
    expect(step.realtime_match).toBe(1);
  });

  it('sets cache_coordinates to 0 for existing steps', () => {
    const taskId = 'task-1';
    db.prepare(
      "INSERT INTO tasks (id, name, status, settings, interrupt_handlers) VALUES (?, ?, ?, ?, ?)"
    ).run(taskId, 'Test', 'idle', JSON.stringify({ screenshotBeforeMatch: false }), '[]');

    db.prepare(
      'INSERT INTO steps (id, task_id, type, "order", config, on_match, on_miss, screenshot_before_match) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('step-1', taskId, 'IMAGE_MATCH', 1, '{}', '{}', '{}', 0);

    runMigrations(db);

    const step = db.prepare('SELECT cache_coordinates FROM steps WHERE id = ?').get('step-1') as any;
    expect(step.cache_coordinates).toBe(0);
  });

  it('updates schema version to 3', () => {
    runMigrations(db);
    expect(getCurrentVersion(db)).toBe(3);
  });
});
