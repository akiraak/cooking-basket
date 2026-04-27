import Database from 'better-sqlite3';
import path from 'path';
import { logger } from './lib/logger';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../shopping.db');

let db: Database.Database | undefined;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

// テスト用: DB ハンドルを閉じてモジュールキャッシュをリセットする。
// 次回 getDatabase() 呼出で再度開き直される。
export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
    } catch {
      // 既に閉じている等は無視
    }
    db = undefined;
  }
}

type Migration = {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
};

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  return row !== undefined;
}

// マイグレーションは「version > _meta.schema_version」のものを順に流す。
// 適用ごとに schema_version をその version に書き戻す。
// catch で握り潰す代わりに `IF NOT EXISTS` / `columnExists` 等で明示的に冪等化する。
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 2,
    name: 'baseline_multi_user',
    up: (db) => {
      // pre-multi-user スキーマをまとめて破棄して再構築する。
      // production はすでに v2 を超えているので走らない（fresh DB / 旧 v1 DB のみ実行される）。
      db.exec(`
        DROP TABLE IF EXISTS dish_items;
        DROP TABLE IF EXISTS dishes;
        DROP TABLE IF EXISTS shopping_items;
        DROP TABLE IF EXISTS purchase_history;
        DROP TABLE IF EXISTS dish_history;
        DROP TABLE IF EXISTS magic_link_tokens;
        DROP TABLE IF EXISTS users;
      `);
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          created_at TEXT DEFAULT (datetime('now')),
          last_login_at TEXT DEFAULT (datetime('now'))
        )
      `);
      db.exec(`
        CREATE TABLE magic_link_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          used INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      db.exec('CREATE INDEX idx_magic_link_tokens_token ON magic_link_tokens(token)');
      db.exec(`
        CREATE TABLE dishes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          ingredients_json TEXT,
          recipes_json TEXT,
          position INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      db.exec('CREATE INDEX idx_dishes_user ON dishes(user_id)');
      db.exec(`
        CREATE TABLE shopping_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          category TEXT DEFAULT '',
          checked INTEGER DEFAULT 0,
          position INTEGER,
          dish_id INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE SET NULL
        )
      `);
      db.exec('CREATE INDEX idx_shopping_items_user ON shopping_items(user_id)');
      db.exec('CREATE INDEX idx_shopping_items_dish ON shopping_items(dish_id)');
      db.exec(`
        CREATE TABLE purchase_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          item_name TEXT NOT NULL,
          purchased_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      db.exec('CREATE INDEX idx_purchase_history_user ON purchase_history(user_id)');
      db.exec(
        'CREATE INDEX idx_purchase_history_name ON purchase_history(item_name COLLATE NOCASE)'
      );
    },
  },
  {
    version: 3,
    name: 'add_magic_link_code_column',
    up: (db) => {
      if (!columnExists(db, 'magic_link_tokens', 'code')) {
        db.exec('ALTER TABLE magic_link_tokens ADD COLUMN code TEXT');
      }
    },
  },
  {
    version: 4,
    name: 'create_saved_recipes',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS saved_recipes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          dish_name TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          steps_json TEXT NOT NULL,
          ingredients_json TEXT NOT NULL,
          source_dish_id INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_saved_recipes_user ON saved_recipes(user_id)');
    },
  },
  {
    version: 5,
    name: 'add_saved_recipes_liked_column',
    up: (db) => {
      if (!columnExists(db, 'saved_recipes', 'liked')) {
        db.exec('ALTER TABLE saved_recipes ADD COLUMN liked INTEGER DEFAULT 0');
      }
    },
  },
  {
    // いいね機能は app-simplification.md で廃止済み。当時のテーブルを過去 DB で削除しておく。
    // CREATE / INSERT 部分は履歴の再現として残す。
    // TODO: confirm prod state, then collapse to a bare `DROP TABLE IF EXISTS recipe_likes`.
    version: 6,
    name: 'create_then_drop_recipe_likes',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS recipe_likes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          saved_recipe_id INTEGER NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (saved_recipe_id) REFERENCES saved_recipes(id) ON DELETE CASCADE,
          UNIQUE(user_id, saved_recipe_id)
        )
      `);
      db.exec(
        'CREATE INDEX IF NOT EXISTS idx_recipe_likes_recipe ON recipe_likes(saved_recipe_id)'
      );
      db.exec('CREATE INDEX IF NOT EXISTS idx_recipe_likes_user ON recipe_likes(user_id)');
      db.exec(`
        INSERT OR IGNORE INTO recipe_likes (user_id, saved_recipe_id)
          SELECT user_id, id FROM saved_recipes WHERE liked = 1
      `);
      db.exec('DROP TABLE IF EXISTS recipe_likes');
    },
  },
  {
    version: 7,
    name: 'add_dishes_active_column',
    up: (db) => {
      if (!columnExists(db, 'dishes', 'active')) {
        db.exec('ALTER TABLE dishes ADD COLUMN active INTEGER DEFAULT 1');
      }
    },
  },
  {
    // dish_items テーブルは shopping_items.dish_id へ統合済み。
    // baseline (v2) 以降は dish_items は存在しないので、tableExists ガードで本体は no-op になる。
    // TODO: confirm prod state, then drop this migration entirely.
    version: 8,
    name: 'merge_dish_items_into_shopping_items',
    up: (db) => {
      if (!columnExists(db, 'shopping_items', 'dish_id')) {
        db.exec('ALTER TABLE shopping_items ADD COLUMN dish_id INTEGER');
      }
      if (tableExists(db, 'dish_items')) {
        db.exec(`
          UPDATE shopping_items SET
            dish_id = (SELECT di.dish_id FROM dish_items di WHERE di.item_id = shopping_items.id LIMIT 1),
            position = COALESCE(
              (SELECT di.position FROM dish_items di WHERE di.item_id = shopping_items.id LIMIT 1),
              shopping_items.position
            )
          WHERE id IN (SELECT item_id FROM dish_items)
        `);
        db.exec('DROP TABLE dish_items');
      }
      db.exec('CREATE INDEX IF NOT EXISTS idx_shopping_items_dish ON shopping_items(dish_id)');
    },
  },
  {
    // dish_history は dishes テーブルで代替されたので不要
    version: 9,
    name: 'drop_dish_history',
    up: (db) => {
      db.exec('DROP TABLE IF EXISTS dish_history');
    },
  },
  {
    version: 10,
    name: 'create_ai_quota',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_quota (
          key TEXT NOT NULL,
          date TEXT NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (key, date)
        )
      `);
    },
  },
  {
    version: 11,
    name: 'create_app_settings',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
  },
];

// 通常呼び出しではモジュールシングルトンの DB へ書き込む。
// テストから別の Database インスタンスを渡すことで、固定経路を介さずに直接マイグレーションを検証できる。
export function initDatabase(database: Database.Database = getDatabase()): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const row = database
    .prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;
  let currentVersion = row ? Number(row.value) : 0;

  const setVersion = database.prepare(
    "INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)"
  );

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    logger.info(
      { version: migration.version, name: migration.name },
      'applying migration'
    );
    const apply = database.transaction(() => {
      migration.up(database);
      setVersion.run(String(migration.version));
    });
    apply();
    currentVersion = migration.version;
  }

  logger.info({ schemaVersion: currentVersion }, 'Database initialized');
}
