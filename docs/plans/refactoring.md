# リファクタリング監査プラン

## 目的・背景

`TODO.md` の「リファクタリング」項目は対象が広いため、まず**監査（調査）**として候補を洗い出して優先度を付ける。
個別の対応は本プランから派生する別プランファイル（命名規則: `docs/plans/refactoring-<area>-<topic>.md`、例: `refactoring-mobile-shopping-store.md`）に分割し、
本プランは「候補棚卸し → 優先度付け → 個別プランへの分解」までをスコープとする。

リファクタの目的は **将来の自分と他人にとってメンテナンスしやすく、理解しやすいコードにすること**。
行数削減・抽象化・パフォーマンスはこれの結果として付いてくるものであり、目的化しない。

## スコープ / 非スコープ

### スコープ
- `server/src/` 配下: routes / services / middleware / lib に加え、**`database.ts` / `app.ts` / `index.ts`（起動・DB 初期化）も対象**
- `mobile/src/` 配下: components / stores / api / utils / hooks / theme / config / types
- `mobile/app/` の画面ファイル（`_layout.tsx` 含む）
- **テストコード自体**（`server/tests/`, `mobile/__tests__/`）の重複・モック濫用・非決定性
- 重複・責務肥大・型の弱さ・テスト不足など、メンテ性に直結する観点での候補抽出

### 非スコープ
- 機能追加・挙動変更
- パフォーマンス最適化（必要なら別タスク）
- `web/about.html`, `web/privacy.html`（ほぼ静的）
- `web/admin/`（**Phase 0 でロジック量を確認したうえで非スコープ妥当性を判定**。重そうなら別プランへ切り出す）
- `dev-admin/`（別途独自プランあり）

## 進め方（Phase 構成）

### Phase 0: ガードレールと一次データ収集
**コード変更なし。** 各 Phase の判断基準と一次データを揃える。

1. 「リファクタリング全般の心得」「プロジェクト固有の注意点」を確認し、各 Phase の作業時に逸脱していないかチェックする基準とする
2. 既存テストの網羅範囲を把握する（`server/tests/`, `mobile/__tests__/`）
3. リファクタ対象領域でテストが薄い箇所をリストアップ。**実際のテスト追加は本プランでは行わず**、個別プラン側で「特性化テスト → リファクタ → テスト維持」の順に進める原則だけ確定
4. **`web/admin/` の取り扱い判定**: ロジック量・依存数を grep ベースで確認し、本プラン対象に含めるか別プランに切り出すかを決める
5. **一次データの取得**（Phase 1/2 で参照する基礎情報）:
   - 行数（`wc -l`）— **初期スクリーニング用**
   - 変更頻度（`git log --since=... --pretty=format: --name-only | sort | uniq -c | sort -nr`）— よく変わるファイルほど読みやすさのリターンが大きい
   - 型の弱さ: `any` / `as` / `// @ts-ignore` の出現箇所
   - 未使用 export / 未使用ファイル: `npx ts-prune`（または同等の手段）
   - 循環依存: `npx madge --circular`
   - ESLint 警告件数（設定がある範囲で）
   - 同一文字列リテラル・同一エラーメッセージの重複（grep ベースの簡易確認で可）

成果物: 一次データのスナップショット（本ファイルの「Phase 0 一次データ」節に追記）

### Phase 1: サーバ側監査

#### 必須チェック（プロジェクト固有の落とし穴を機械的に拾う）
- [ ] `requireAuth` と `requireCloudflareAccess` の二重掛けが存在しないか grep
- [ ] `{ success, data, error }` 形式から逸脱しているレスポンスがないか
- [ ] route 層で SQL を直接叩いている箇所がないか
- [ ] 外部 API（Gemini / Resend / Google OAuth）の呼び出しがサービス層境界に閉じているか

#### 観点（候補抽出のための定性チェック）
- ルートとサービスの責務分離
- service 層の関数粒度（1 関数で複数責務になっていないか）
- 型定義の重複・`any` の混入
- 認証ミドルウェアの使い分けが正しいか
- エラーハンドリングの一貫性
- 起動・DB 初期化（`database.ts` / `app.ts` / `index.ts`）の見通し

#### 候補抽出の手順
1. Phase 0 の一次データ（行数・変更頻度・`any` 件数・未使用 export 等）の上位を出す
2. 各候補に対し、**証拠（ファイルパス + 行番号 + 抜粋 or 関数名 + 重複箇所一覧）** を必ず添える
3. 観点のうちどれに該当するかをタグ付け
4. ラフな想定工数（半日 / 1〜2 日 / 数日）とリスク（テスト薄 / 影響範囲広 等）を記載

参考: 行数の大きい順（初期スクリーニング用）
- `server/src/routes/docs.ts` (418 行)
- `server/src/services/admin-service.ts` (295 行)
- `server/src/routes/admin.ts` (285 行)
- `server/src/services/logs-service.ts` (234 行)
- その他 routes / services / middleware / lib / 起動系

成果物: サーバ側候補リスト（候補ごとに「ファイル / 観点 / 証拠 / 想定工数 / リスク」）

### Phase 2: モバイル側監査

#### 必須チェック
- [ ] `mobile/src/api/` から `/api/admin` を叩いていないか grep（CLAUDE.md 明記の禁止事項）
- [ ] `mobile/src/types/models.ts` と各所のインライン型の重複
- [ ] `stores/` の状態と `__tests__/stores/` の対応

#### 観点
- 画面ファイル（`app/(tabs)/*.tsx`, `_layout.tsx`）にロジックが集中していないか
- Zustand store の責務肥大（actions と selectors の分離、派生状態の整理）
- API クライアント層（`mobile/src/api/`）の型・エラー処理の統一感
- コンポーネントの責務（表示 vs 状態管理）
- `mobile/src/utils/` 配下の凝集度（`migration.ts` の延命要否を含む）
- `hooks/` `theme/` `config/` の利用状況と凝集度

#### 候補抽出の手順
Phase 1 と同じ。**必ず証拠を添える**。

参考: 行数の大きい順（初期スクリーニング用）
- `mobile/app/(tabs)/index.tsx` (503 行)
- `mobile/src/components/dishes/IngredientsScreen.tsx` (457 行)
- `mobile/src/stores/shopping-store.ts` (399 行)
- `mobile/src/components/ui/DraggableList.tsx` (341 行)
- `mobile/src/components/auth/AuthModal.tsx` (298 行)
- `mobile/src/components/shopping/AddModal.tsx` (257 行)
- `mobile/app/(tabs)/_layout.tsx` (177 行)
- `mobile/app/(tabs)/recipes.tsx` (100 行)
- その他 components / stores / api / utils / hooks

成果物: モバイル側候補リスト（候補ごとに「ファイル / 観点 / 証拠 / 想定工数 / リスク」）

### Phase 3: 優先度付けと個別プランへの分解

1. Phase 1 / 2 の候補リストを以下の軸で評価:
   - **メンテ性インパクト**: 直すと将来の変更がどれだけ楽になるか（変更頻度 × 読みにくさ）
   - **リスク**: テストカバレッジ、影響範囲、本番ユーザーへの影響
   - **工数**: 半日 / 1〜2 日 / 数日 のラフな粒度
2. **個別プランへの分解の打ち切り基準**: 上位 3〜5 件、または「想定工数 1〜2 日以下 × メンテ性インパクト中以上」のものを優先。残りは候補リストに残し、本プラン archive 後の TODO ストックとする
3. 上位候補について `docs/plans/refactoring-<area>-<topic>.md` として個別プランを起こす（命名規則は冒頭参照）
4. `TODO.md` に個別タスクとして追加し、本監査プランは Phase 3 完了をもって `docs/plans/archive/` へ移送する（個別プランの完了は待たない）

## リファクタリング全般の心得（プロジェクト全体に効く価値観）

1. **メンテナンスのしやすさ・理解のしやすさを最優先する** — リファクタの目的は将来の自分と他人が読みやすく直しやすくすること。行数削減・抽象化・パフォーマンスはこれの結果として付いてくるもので、目的化しない
2. 機能変更と純粋リファクタは混ぜない — コミット / PR 単位で分離
3. 小さく刻む — 1 PR = 1 目的（1 ファイル分割 / 1 関数抽出 程度）
4. 過剰抽象化しない — YAGNI。3 箇所で同じパターンが出てから共通化。1〜2 箇所なら重複で OK
5. テストでガードしてから動かす — テストがない領域はまず特性化テストを書いてからリファクタする。書きづらいなら設計が悪いサインなので構造ごと見直す
6. 挙動を変えないこと最優先 — 「ついでに直したくなる」誘惑を抑える。気づいた別問題は TODO に追加して別タスクへ
7. 巨大ファイルは "分割後に見通しが良くなるか" で判断 — 行数だけで切ると、状態の流れが追えない分割になりがち
8. pre-commit フック (`husky`) を無効化しない — `--no-verify` 禁止
9. strict モード / 型を弱めない — `any` を増やすリファクタは劣化
10. 古いコメント・dead code は同時に消す — 明確に古いものに限る
11. **未使用の機能やコードは削除する** — 呼び出されていない関数・到達不能な分岐・参照されていないファイル / 型 / 依存は積極的に削除。「いつか使うかも」で残さない。Git 履歴に残るので必要になれば復元できる

## このプロジェクト固有の注意点（監査時にも実装時にも効く制約）

1. **API レスポンス形式 `{ success, data, error }` は固定** — モバイルが依存している。形だけ整えるリファクタでも変えない
2. **認証ミドルウェアの二重掛け禁止** — `requireAuth`（`req.userEmail`）と `requireCloudflareAccess`（`req.adminEmail`）を同じルートに重ねない
3. **モバイル → `/api/admin` は禁止** — ルートやクライアント整理で誤って繋げない
4. **DB スキーマ変更はマイグレーション必須** — 既存ユーザーデータが本番にある。SQLite の ALTER 制約に注意
5. **モバイルは RN コンポーネント描画テスト未導入** — UI 系リファクタは手動検証必須。型と単体テストでは UI 崩れを検出できない
6. **`stores/` を変えたら `__tests__/stores/` を更新**、サーバ service / route の変更も対応テスト更新
7. **ローカル管理画面の動作確認には `ADMIN_AUTH_DEV_BYPASS=1`** が必要（`server/.env`）

## テスト方針

- 監査フェーズ（本プラン）自体はコードを変更しないためテスト追加なし
- Phase 0 で薄い領域をリスト化するに留め、特性化テスト追加は個別プラン側で実施
- 個別リファクタプランでは、対象領域のテスト網羅状況を起票時に必ず明記する
- モバイル UI は手動検証手順を個別プランに記載

## 影響範囲

- 本プラン（監査）: コード変更なし。`docs/plans/refactoring.md` への追記と `TODO.md` 更新のみ
- 後続の個別プラン: 各プランで明記

## 完了条件

- [x] Phase 0: 一次データ（行数 / 変更頻度 / `any` 件数 / 未使用 export / 循環依存 / ESLint 警告 / 重複リテラル）が「Phase 0 一次データ」節に追記され、`web/admin/` の扱いが確定している
- [ ] Phase 1: サーバ側候補リスト（証拠付き）が本ファイルに追記され、必須チェックがすべて消化されている
- [ ] Phase 2: モバイル側候補リスト（証拠付き）が本ファイルに追記され、必須チェックがすべて消化されている
- [ ] Phase 3: 優先度付け済み上位候補が個別プランファイルとして起こされ、`TODO.md` に追加されている
- [ ] 本プランは `docs/plans/archive/` に移送されている（個別プランの完了は待たない）

## Phase 0 一次データ

スナップショット日: 2026-04-27（コード変更なし）。Phase 1/2 はこの節を参照する。

### 0.1 ガードレール確認

- 「リファクタリング全般の心得」「このプロジェクト固有の注意点」は本ファイル末尾の節にすでに整備済み。Phase 1/2 で候補抽出する際に、**心得 4（過剰抽象化禁止: 3 箇所重複から共通化）/ 心得 6（挙動を変えない）/ 注意点 1（API レスポンス形式固定）/ 注意点 2（認証ミドルウェア二重掛け禁止）/ 注意点 3（モバイルから `/api/admin` 禁止）** を必ずチェック項目として走らせる。
- 心得 11（未使用機能の削除）は本フェーズの「未使用 export」一覧と接続する。

### 0.2 テスト網羅範囲と薄い領域

- **server**: テストファイル 20（unit 9 / integration 10 / helpers 3）。`tests/setup.ts` が `/tmp/cb-test-<pid>.db` を強制し本体 DB を保護。
- **mobile**: テストファイル 11（api 2 / stores 4 / utils 2 / components 1 / config 1 / smoke 1）。RN コンポーネント描画テストは未導入（CLAUDE.md 明記）。

テストが薄い領域（個別プランで「特性化テスト → リファクタ → テスト維持」の対象）:

| 領域 | ファイル | LoC | 状況 |
| --- | --- | ---: | --- |
| server | `routes/docs.ts` | 418 | 専用テストなし。最大ファイル |
| server | `services/logs-service.ts` | 234 | 専用テストなし |
| server | `services/gemini-service.ts` | 15 | テストなし。ただし外部 API 薄ラッパなので mock 境界として妥当 |
| server | `middleware/cloudflare-access.ts` | 114 | `integration/admin-cloudflare-auth.test.ts` で間接カバーのみ |
| server | `middleware/error-handler.ts` | 17 | 専用テストなし |
| server | `middleware/rate-limit-ai.ts` | 64 | `integration/ai-quota.test.ts` で間接カバーのみ |
| server | `database.ts` / `index.ts` | 254 / 18 | integration 経由のみ |
| mobile | `api/dishes.ts` / `api/migrate.ts` / `api/saved-recipes.ts` | 59 / 48 / 34 | 専用テストなし |
| mobile | `utils/token.ts` | 15 | テストなし |
| mobile | `hooks/use-debounce.ts` | 12 | テストなし |
| mobile | `components/**/*` 全般 | — | RN 描画テスト未導入。UI 系リファクタは手動検証必須 |

### 0.3 `web/admin/` の取り扱い判定

- 構成: `app.js` 942 LoC（vanilla JS、`import`/`require` 無し）+ `style.css` 958 LoC + `index.html` 66 LoC。
- 通信先は `/api/admin` のみ（`const API = '/api/admin'`）。Cloudflare Access ＋ `requireCloudflareAccess` 系統で完全に独立。
- ロジック規模は無視できないが、技術スタック（vanilla JS）も認証経路（Cloudflare Access）もサーバ/モバイル本体と独立しているため、**本プランのスコープからは外す**。
- 必要なら Phase 3 で別プラン `refactoring-web-admin.md` を起こすか、TODO ストックに残すかを判定する。

### 0.4 行数（初期スクリーニング用）

server `src/` 上位:

| LoC | ファイル |
| ---: | --- |
| 418 | `routes/docs.ts` |
| 295 | `services/admin-service.ts` |
| 285 | `routes/admin.ts` |
| 254 | `database.ts` |
| 234 | `services/logs-service.ts` |
| 164 | `routes/dishes.ts` |
| 128 | `services/saved-recipe-service.ts` |
| 127 | `services/auth-service.ts` |
| 126 | `routes/migrate.ts` |
| 115 | `services/dish-service.ts` |
| 114 | `middleware/cloudflare-access.ts` |
| 100 | `app.ts` / `services/shopping-service.ts` |

mobile `src/` + `app/` 上位:

| LoC | ファイル |
| ---: | --- |
| 503 | `app/(tabs)/index.tsx` |
| 457 | `src/components/dishes/IngredientsScreen.tsx` |
| 399 | `src/stores/shopping-store.ts` |
| 341 | `src/components/ui/DraggableList.tsx` |
| 298 | `src/components/auth/AuthModal.tsx` |
| 257 | `src/components/shopping/AddModal.tsx` |
| 177 | `app/(tabs)/_layout.tsx` |
| 165 | `src/components/shopping/DishGroup.tsx` |
| 158 | `src/stores/auth-store.ts` |
| 136 | `src/components/recipes/RecipeListItem.tsx` |
| 133 | `src/stores/recipe-store.ts` |
| 131 | `src/components/dishes/RecipeCard.tsx` |
| 120 | `src/utils/migration.ts` |

### 0.5 変更頻度（直近 6 ヶ月、削除済みファイルは除外）

server 上位（コミット数）:

| 件 | ファイル |
| ---: | --- |
| 20 | `database.ts` |
| 19 | `index.ts` |
| 18 | `routes/dishes.ts` |
| 15 | `routes/admin.ts` |
| 13 | `services/admin-service.ts` |
| 10 | `services/saved-recipe-service.ts` |
| 10 | `services/dish-service.ts` |
| 9 | `services/shopping-service.ts` |
| 7 | `services/auth-service.ts` / `routes/shopping.ts` / `routes/saved-recipes.ts` / `app.ts` |
| 5 | `routes/docs.ts` |

mobile 上位（コミット数）:

| 件 | ファイル |
| ---: | --- |
| 16 | `app/(tabs)/index.tsx` |
| 14 | `src/components/dishes/IngredientsScreen.tsx` |
| 12 | `src/components/shopping/DishGroup.tsx` |
| 9 | `src/components/shopping/ShoppingItemRow.tsx` / `app/_layout.tsx` |
| 8 | `src/components/ui/DraggableList.tsx` / `app/(tabs)/_layout.tsx` |
| 7 | `src/stores/shopping-store.ts` |
| 6 | `src/stores/auth-store.ts` / `src/components/shopping/AddModal.tsx` / `app/(tabs)/recipes.tsx` |
| 5 | `src/components/auth/AuthModal.tsx` / `src/api/ai.ts` |

「LoC × 変更頻度」の重なりが厚い箇所（Phase 1/2 で優先評価する候補）:

- server: `routes/admin.ts`（285 / 15）、`services/admin-service.ts`（295 / 13）、`database.ts`（254 / 20）、`routes/dishes.ts`（164 / 18）、`services/saved-recipe-service.ts`（128 / 10）
- mobile: `app/(tabs)/index.tsx`（503 / 16）、`src/components/dishes/IngredientsScreen.tsx`（457 / 14）、`src/components/ui/DraggableList.tsx`（341 / 8）、`src/stores/shopping-store.ts`（399 / 7）

### 0.6 型の弱さ

- `any`: 計 10 件、**すべて `server/src/services/admin-service.ts`**。better-sqlite3 の `get()` 結果に対する `as any` キャスト（行 10–22 の COUNT 集計、行 77 の動的バインド配列、行 213 の集計結果、行 279 の `tableCounts` ループ）。→ Phase 1 候補（型付きヘルパ抽出 or 戻り値型を明示）。
- `as <Type>` キャスト合計: 36 件。トップは `services/shopping-service.ts`（5）、`services/auth-service.ts`（5）、`services/saved-recipe-service.ts`（4）、`services/dish-service.ts`（4）、`services/dish-ai.ts`（3）、`mobile/src/utils/device-id.ts`（3）。多くは DB 行 → ドメイン型のキャスト想定（要 Phase 1 確認）。
- `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`: **0 件**。
- mobile の `any` 使用: **0 件**。

### 0.7 未使用 export（`ts-prune`）

実質的に未使用と思われる候補（Phase 1/2 で「本当に未使用か」を確認した上で、心得 11 に従い削除候補に上げる）:

- server
  - `database.ts:21 closeDatabase`
  - `services/saved-recipe-service.ts:94 getSavedRecipeStates`
  - `services/saved-recipe-service.ts:105 autoSaveRecipes`
  - `services/shopping-service.ts:71 deleteAllItems`
  - `services/shopping-service.ts:77 getUncheckedItems`
  - `services/shopping-service.ts:82 getStats`
- mobile
  - `src/hooks/use-debounce.ts:3 useDebounce`（ファイル全体が未使用なら削除対象）
  - `src/types/models.ts:45 SuggestIngredientsResponse`
  - `src/components/ui/DraggableList.tsx:317 DragOverlay`
  - `src/components/ui/SuggestionsList.tsx:14 SuggestionsList`（モジュール自体が呼ばれているか要確認）

意図的に残す既知の偽陽性:

- server: `_resetCloudflareAccessJwksCacheForTest`, `_resetAiLimitsCacheForTest`（テストリセットフック）。`(used in module)` 付きの型定義は実装内利用で正常。
- mobile: ルートファイルの `default` export（Expo Router 規約）。

### 0.8 循環依存（`madge --circular`）

- server `src/`: **0 件**
- mobile `src/` + `app/`: **0 件**

### 0.9 ESLint

- server / mobile とも ESLint 設定・スクリプト未設定 → **該当なし**。本フェーズの観測点として記録。設定追加は本プランのスコープ外（必要なら別タスク）。

### 0.10 重複リテラル / エラーメッセージ

server で 3 回以上重複している `error: '...'` 文字列（候補: メッセージ定数化 / バリデーション層共通化）:

| 重複数 | メッセージ |
| ---: | --- |
| 4 | `'食材が見つかりません'` |
| 4 | `'料理が見つかりません'` |
| 4 | `'invalid_ai_limit'` |
| 3 | `'レシピが見つかりません'` |
| 3 | `'name は必須です'` |
| 3 | `'invalid_scope'` |

mobile はハードコード `throw new Error('...')` が 1 件のみ（`'料理が見つかりません'`）。重複なし。

### 0.11 Phase 0 から導かれる Phase 1/2 のフォーカス

- **server で重なり最大**: `services/admin-service.ts`（高 LoC + 高頻度 + `any` 集中）、`routes/admin.ts`（高 LoC + 高頻度）、`database.ts`（最高頻度・起動／DB 初期化の見通し）、`routes/dishes.ts`（高頻度・middle LoC）、`routes/docs.ts`（最大 LoC・テストなし）。
- **mobile で重なり最大**: `app/(tabs)/index.tsx`（最大 LoC + 最高頻度・画面ファイル肥大）、`components/dishes/IngredientsScreen.tsx`（高 LoC + 高頻度）、`stores/shopping-store.ts`（高 LoC・store 責務肥大の典型）、`components/ui/DraggableList.tsx`（高 LoC + 中頻度）。
- **横断テーマ**: server エラーメッセージ重複の整理、`admin-service.ts` の `any` 解消、未使用 export（特に `shopping-service.ts` の 3 関数）。

## 候補リスト

### サーバ
（Phase 1 で記入。各候補は「ファイル / 観点 / **証拠（行番号・関数名・重複箇所）** / 想定工数 / リスク」）

### モバイル
（Phase 2 で記入。各候補は「ファイル / 観点 / **証拠（行番号・関数名・重複箇所）** / 想定工数 / リスク」）
