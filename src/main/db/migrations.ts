import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  up: (db: Database.Database) => void;
}

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

  const pendingMigrations = additionalMigrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pendingMigrations) {
    migration.up(db);
  }
}
