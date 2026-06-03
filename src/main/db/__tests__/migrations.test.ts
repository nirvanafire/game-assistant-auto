import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { createSchema } from '../schema.js';
import { getCurrentVersion, runMigrations, Migration } from '../migrations.js';

describe('migrations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  it('getCurrentVersion returns schema version', () => {
    const version = getCurrentVersion(db);
    expect(version).toBe(3);
  });

  it('returns current version when no migrations needed', () => {
    const version = getCurrentVersion(db);
    expect(version).toBe(3);

    runMigrations(db);
    expect(getCurrentVersion(db)).toBe(3);
  });

  it('skips already-applied migrations', () => {
    const migrations: Migration[] = [
      {
        version: 3,
        up: (db: Database.Database) => {
          db.exec(`ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0`);
        },
      },
      {
        version: 4,
        up: (db: Database.Database) => {
          db.exec(`ALTER TABLE tasks ADD COLUMN tags JSON DEFAULT '[]'`);
        },
      },
    ];

    runMigrations(db, migrations);
    expect(getCurrentVersion(db)).toBe(4);

    // Run again - should be a no-op
    runMigrations(db, migrations);
    expect(getCurrentVersion(db)).toBe(4);
  });

  it('runs additional migrations when available', () => {
    const migrations: Migration[] = [
      {
        version: 4,
        up: (db: Database.Database) => {
          db.exec(`ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0`);
        },
      },
    ];

    expect(getCurrentVersion(db)).toBe(3);

    runMigrations(db, migrations);

    expect(getCurrentVersion(db)).toBe(4);

    // Verify the column was added
    const columns = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('priority');
  });
});
