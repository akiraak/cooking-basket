import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MIGRATIONS, initDatabase } from '../../src/database';

// マイグレーションは database.ts のシングルトンを介さずに、独立した一時 DB に対して検証する。
// setupTestDatabase が管理する /tmp/cb-test-<pid>.db には触らない。

function tmpDbPath(label: string): string {
  return path.join('/tmp', `cb-migration-test-${process.pid}-${label}-${Date.now()}.db`);
}

function deleteDbFiles(dbPath: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(dbPath + suffix);
    } catch {
      // ファイルが無ければ無視
    }
  }
}

function getSchemaVersion(db: Database.Database): number {
  const row = db
    .prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;
  return row ? Number(row.value) : 0;
}

function tableExists(db: Database.Database, name: string): boolean {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)
  );
}

function columnNames(db: Database.Database, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

describe('database migrations / fresh DB', () => {
  let dbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    dbPath = tmpDbPath('fresh');
    deleteDbFiles(dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
    deleteDbFiles(dbPath);
  });

  it('applies all migrations and ends at the latest schema_version', () => {
    initDatabase(db);

    expect(getSchemaVersion(db)).toBe(LATEST_VERSION);
  });

  it('creates all expected tables and key columns', () => {
    initDatabase(db);

    for (const t of [
      'users',
      'magic_link_tokens',
      'dishes',
      'shopping_items',
      'purchase_history',
      'saved_recipes',
      'ai_quota',
      'app_settings',
    ]) {
      expect(tableExists(db, t)).toBe(true);
    }

    // 廃止済みテーブルは存在しないこと
    expect(tableExists(db, 'recipe_likes')).toBe(false);
    expect(tableExists(db, 'dish_history')).toBe(false);
    expect(tableExists(db, 'dish_items')).toBe(false);

    // 後付けカラムが入っていること
    expect(columnNames(db, 'magic_link_tokens')).toContain('code');
    expect(columnNames(db, 'saved_recipes')).toContain('liked');
    expect(columnNames(db, 'dishes')).toContain('active');
    expect(columnNames(db, 'shopping_items')).toContain('dish_id');
  });

  it('is idempotent on a second invocation', () => {
    initDatabase(db);
    expect(getSchemaVersion(db)).toBe(LATEST_VERSION);

    // 2 回目はどのマイグレーションも走らず、スキーマも壊さない
    initDatabase(db);
    expect(getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(tableExists(db, 'users')).toBe(true);
  });
});

describe('database migrations / from existing v2 DB', () => {
  let dbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    dbPath = tmpDbPath('v2');
    deleteDbFiles(dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // baseline (v2) だけ手動で適用した状態を再現する
    db.exec('CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const baseline = MIGRATIONS.find((m) => m.version === 2);
    if (!baseline) throw new Error('baseline migration v2 missing');
    baseline.up(db);
    db.prepare("INSERT INTO _meta (key, value) VALUES ('schema_version', '2')").run();
  });

  afterEach(() => {
    db.close();
    deleteDbFiles(dbPath);
  });

  it('runs only the post-v2 migrations and reaches the latest version', () => {
    expect(getSchemaVersion(db)).toBe(2);
    expect(columnNames(db, 'magic_link_tokens')).not.toContain('code');
    expect(tableExists(db, 'saved_recipes')).toBe(false);

    initDatabase(db);

    expect(getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(columnNames(db, 'magic_link_tokens')).toContain('code');
    expect(tableExists(db, 'saved_recipes')).toBe(true);
    expect(columnNames(db, 'saved_recipes')).toContain('liked');
    expect(columnNames(db, 'dishes')).toContain('active');
    expect(tableExists(db, 'recipe_likes')).toBe(false);
    expect(tableExists(db, 'ai_quota')).toBe(true);
    expect(tableExists(db, 'app_settings')).toBe(true);
  });
});
