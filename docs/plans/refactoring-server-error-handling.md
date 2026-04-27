# サーバ route 層のエラーハンドリング統一 + メッセージ定数化

由来: [refactoring.md](archive/refactoring.md) Phase 1 候補 S1 + S7

## 目的・背景

`routes/dishes.ts` / `routes/saved-recipes.ts` / `routes/migrate.ts` / `routes/shopping.ts` の多くのルートが
`try { ... } catch (err) { res.status(500).json({ success: false, error: String(err) }) }` というパターンで自前処理しており、
内部例外メッセージ（`Error: ...` の `toString()` 結果）がそのままクライアントへ漏れる。
一方で `routes/auth.ts` / `routes/ai.ts` は `next(err)` を呼び `middleware/error-handler.ts` に集約しているため、
**同じプロジェクト内に 2 系統のエラーハンドリングが共存している**。

加えて、route 内で同じ日本語エラーメッセージリテラルが 3 箇所以上で重複している
（`'食材が見つかりません'` × 4、`'料理が見つかりません'` × 4、`'invalid_ai_limit'` × 4 など）。
心得 4（3 箇所重複は共通化）に該当する。

リファクタの目的は **エラー処理を 1 系統に寄せて読みやすくし、内部メッセージの漏洩を止めること**。

## 対応方針

### Step 1: route のエラー分岐を `next(err)` 経由に統一
- `routes/dishes.ts`, `routes/saved-recipes.ts`, `routes/migrate.ts`, `routes/shopping.ts` の `try/catch` を
  `try { ... } catch (err) { next(err); }` に揃え、レスポンス形成は `middleware/error-handler.ts` に任せる。
- ビジネスロジック起因の 4xx は service 層で型付き Error（例: `NotFoundError`, `ValidationError`）を投げる、
  または route 層で 400/404 を `res.status(...).json({ success:false, error: '...' })` として明示返却する形を維持する。
  **500 系（想定外例外）だけを `next(err)` に寄せる**。
- `next(err)` 採用後は `errorHandler` が `err.message || 'Internal Server Error'` を返すため、
  `String(err)` で前段に出ていた `Error: ...` プレフィックスが消える。

### Step 2: エラーメッセージリテラル定数化
- `server/src/lib/errors.ts`（新規）に頻出メッセージを集約:
  ```ts
  export const ERR = {
    DISH_NOT_FOUND: '料理が見つかりません',
    ITEM_NOT_FOUND: '食材が見つかりません',
    SAVED_RECIPE_NOT_FOUND: 'レシピが見つかりません',
    NAME_REQUIRED: 'name は必須です',
    INVALID_AI_LIMIT: 'invalid_ai_limit',
    INVALID_SCOPE: 'invalid_scope',
  } as const;
  ```
- 上記 6 種を該当 route から import 参照に置換。
- 定数化対象は **3 箇所以上重複しているもののみ**（心得 4）。1〜2 箇所のものは現状維持。

### 影響範囲
- `server/src/routes/{dishes,saved-recipes,migrate,shopping,admin}.ts`
- `server/src/lib/errors.ts`（新規）
- 既存 `errorHandler`・既存 service 層は変更なし
- API レスポンス形式 `{ success, data, error }` は維持（注意点 1）

## テスト方針

- 既存: `tests/integration/dishes.test.ts` 他で 500 系レスポンス body を検証している箇所があれば差分を吸収。
  `error: 'Error: ...'` のような前置きを期待しているテストは新形式（純粋メッセージ）に追従する。
- 追加: `errorHandler` の最終 fallback（未知例外時）が `'Internal Server Error'` を返すケースの integration テストが
  既存になければ 1 ケース追加（薄い service モックで例外を意図的に投げる）。
- メッセージ定数化は文字列が変わらないので既存テストは pass する想定。

## 想定工数
1〜2 日

## リスク
- 低。`errorHandler` は既存配線済み（`app.ts:93`）。最大リスクは「テストが内部メッセージ文字列に依存しているケース」だが
  Step 1 着手前に grep で洗い出す。

## メンテ性インパクト
- 高（一貫性 + セキュリティ）

## 心得・注意点チェック
- 心得 1（メンテしやすさ最優先）✓ / 心得 4（重複共通化）✓ / 心得 6（挙動を変えない=500 ステータスは維持）✓
- 注意点 1（API 形式維持）✓ / 注意点 2（認証ミドルウェア二重掛けなし）✓
