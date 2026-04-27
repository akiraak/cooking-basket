# `database.ts` のマイグレーション整理

由来: [refactoring.md](archive/refactoring.md) Phase 1 候補 S4

## 目的・背景

`server/src/database.ts`（254 LoC、変更頻度 20 = サーバ最高）は以下が混在:

- `SCHEMA_VERSION = 2`（行 6）— マルチユーザー対応以降のカラム/テーブル追加（ai_quota / app_settings / saved_recipes / liked / active / dish_id 等）はすべて **バージョン管理外**
- 9 個の `try { database.exec(...) } catch {}` ブロック（行 134–228）が並ぶ。**「カラム/テーブルが既に存在する場合は無視」/「既に消えている場合は無視」が暗黙のセマンティクスになっており、本当に失敗したのか冪等で済んだのかが見分けられない**
- 行 169–193 の `recipe_likes` ブロックがコメントで「いいね機能は廃止済み（app-simplification.md）。下記ブロックは履歴として残し、末尾の DROP TABLE マイグレーションで本番 DB から削除する」と明記。行 197 で DROP 済 → 心得 11（未使用機能の削除）に従い CREATE / INSERT OR IGNORE 部分は削除可
- 行 209–228 の `dish_items` 統合マイグレーションも、本番が完了していれば不要

リファクタの目的は **起動経路（`database.ts` / `index.ts` / `app.ts`）の見通しを良くし、本番に効いていない死んだ移行コードを安全に消すこと**。

## 対応方針

### Step 1: マイグレーション登録パターンの導入
- 「`SCHEMA_VERSION = N` のとき、未適用のものを順に流す」配列ベースの登録方式に集約:
  ```ts
  const MIGRATIONS: { version: number; name: string; up: (db: Database) => void }[] = [
    { version: 3, name: 'add_user_id_to_dishes', up: (db) => db.exec('ALTER TABLE dishes ADD COLUMN user_id ...') },
    { version: 4, name: 'create_saved_recipes', up: (db) => db.exec('CREATE TABLE IF NOT EXISTS saved_recipes ...') },
    // ...
  ];
  ```
- `pragma user_version` を見て `version > current` のものを順次実行。
- **既存の `try { ... } catch {}` 暗黙冪等は明示的な `IF NOT EXISTS` / `IF EXISTS` でカバー**し、catch で握り潰す箇所をなくす。
- `IF NOT EXISTS` で表現できない（例: `ALTER TABLE ADD COLUMN` の冪等化）箇所は、
  事前 `pragma table_info(...)` でカラム有無を確認してから `ALTER` を流す形に書き換える。

### Step 2: 完了済み移行ブロックの除去（要本番状態確認）
- 削除候補:
  - 行 172–193 の `recipe_likes` CREATE / INSERT OR IGNORE 部分（行 197 の DROP は残す or 確認後に履歴ごと削除）
  - 行 209–228 の `dish_items` 統合マイグレーション（本番 DB が既に統合済みなら）
- **削除前の確認手順**:
  1. 本番 DB の `pragma user_version` と該当テーブルの存在/カラム構成を確認（管理画面 SystemInfo もしくは admin SSH 経由）
  2. 削除しても新規環境（テスト含む）で初期化が壊れないことを確認
  3. 古い本番 DB をマイグレートする経路が必要なら **削除せず、Step 1 のマイグレーション登録に正式に乗せる**
- 削除可と判断できた場合のみ削除する。判断保留の場合は `// TODO: confirm prod state, then remove` コメントで残す（心得 10: 古いコメント・dead code は明確に古いものに限る）。

### Step 3: 起動経路の整理
- `database.ts` / `index.ts` / `app.ts` で「DB 初期化 → マイグレーション → サーバ起動」の流れが一目で読めるように関数名/順序を整える。
- `database.ts` から逐次実行している副作用（cleanup タイマ等）が混じっていないことを確認する。
  混じっていれば `index.ts` 側に寄せる。

### 影響範囲
- `server/src/database.ts`（最大）
- `server/src/index.ts`（起動シーケンスを少し触る可能性）
- 既存の単体テスト（`tests/setup.ts` の `/tmp/cb-test-<pid>.db` 強制で本体 DB は守られる）

## テスト方針

- 既存 integration テストを「初期化 → マイグレーション流れた DB」に対して走らせて全 pass を維持。
- 追加: 新規空 DB に対し全マイグレーションが順次適用されて最終スキーマに到達することを検証する unit テスト 1 本。
- 既存 DB（`/tmp/cb-test-<pid>.db` ではなく**故意に旧スキーマで作った DB**）に対して
  マイグレーションが冪等に当たることの確認テスト 1 本（version 1 / version 2 から最新まで up）。

## 想定工数
1〜2 日

## リスク
- 中〜高。本番 DB がある（注意点 4: DB スキーマ変更必須はマイグレーション）。
- Step 2 の削除判断は**実際に本番 DB の状態を確認してから**行う。
- 不確実なら Step 2 を分離して別 PR にする（Step 1 と Step 3 だけ先行マージ可）。

## メンテ性インパクト
- 高（変更頻度トップ・起動経路）

## 心得・注意点チェック
- 心得 6（挙動を変えない: マイグレーション最終結果は同一）✓ / 心得 11（未使用コード削除）✓
- 注意点 4（DB スキーマ変更はマイグレーション必須）✓ ── 既存ユーザーデータを壊さないことを最優先
