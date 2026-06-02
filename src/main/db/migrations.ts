import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  {
    version: 2,
    up: (db: Database.Database) => {
      db.exec(`
        ALTER TABLE task_groups ADD COLUMN loop_enabled INTEGER DEFAULT 0;
        ALTER TABLE task_groups ADD COLUMN loop_interval_ms INTEGER DEFAULT 0;
        ALTER TABLE task_groups ADD COLUMN loop_max_iterations INTEGER DEFAULT 0;
        ALTER TABLE task_group_items ADD COLUMN on_success TEXT DEFAULT NULL;
        ALTER TABLE task_group_items ADD COLUMN on_failure TEXT DEFAULT NULL;
      `);
    },
  },
];

export function getCurrentVersion(db: Database.Database): number {
  const row = db
    .prepare('SELECT MAX(version) as version FROM schema_version')
    .get() as { version: number | null };
  return row.version ?? 0;
}

export function runMigrations(
  db: Database.Database,
  additionalMigrations: Migration[] = [],
): void {
  const currentVersion = getCurrentVersion(db);

  const allMigrations = [...migrations, ...additionalMigrations];
  const pendingMigrations = allMigrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pendingMigrations) {
    migration.up(db);
    db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(migration.version);
  }
}
