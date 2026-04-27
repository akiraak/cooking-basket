# リファクタリング 8: `shopping-store.ts` の local / server 二重実装の解消

> **ステータス**: ドラフト（設計判断要）
> **想定規模**: 数日（Phase 単位で着地可能）
> **関連 TODO**: 「リファクタリング 8（M1）」 / 後続 M2 = リファクタリング 9（`app/(tabs)/index.tsx` 責務漏出）

## 目的・背景

`mobile/src/stores/shopping-store.ts` のほぼ全アクション（`addItem` / `addDish` /
`toggleCheck` / `deleteItem` / `link*` / `reorder*` …）が
`if (get().mode === 'local') { ... pure state mutation ... } else { ... API + (loadAll | optimistic) ... }`
の二段構えで書かれている。同じ操作のセマンティクスが 2 か所に分散しているため:

- ロジックを変更するときに片方だけ直す事故が起きやすい（例: 並び替えの既知挙動
  — ローカルは items の `position` を更新するが、サーバモードはそもそも state を触らず
  呼び出し側で `useShoppingStore.setState(...)` する設計になっている。
  → 一見壊れているように見える非対称性を持つ）
- サーバモードの「API → `loadAll()` で全件再取得」と「API → 楽観更新で済ませる」が
  操作によってまちまち（`addItem` / `addDish` / `deleteCheckedItems` /
  `link*` / `unlink*` は loadAll、`toggleCheck` / `updateItemName` /
  `deleteItem` / `updateDish` は楽観）。レイテンシ・体感も操作で揺れる
- ローカルモードのテストとサーバモードのテストが完全に分かれており、本質的に
  同じセマンティクスのアサートが二重化している
- recipe-store も同型（local/server）の二段構えなので、解法を共通化できる

最終的に「アクションの本体は 1 通り。永続化先（in-memory only / server）だけ差し替える」
形にしたい。これは TODO 9（M2: `app/(tabs)/index.tsx` の責務漏出）の前提として効く
— ストア側の API が安定するほど画面側からの「ストアを迂回した直接 API 呼び出し」
（現状 `index.tsx` に複数あり）を畳みやすくなる。

## 現状の構造（要点）

- `Mode = 'local' | 'server'`。local モードは AsyncStorage に永続化、サーバモードは API に同期
- ID 採番:
  - local モードでは `nextLocalId` から負の連番で発行
  - 一度サーバに移行したアイテム/料理/レシピはサーバ ID（正の整数）になる
- ログアウトは `setMode('local')` ではなく `setState({ mode: 'local' })` を使う。
  画面に出ていたデータを残すための意図的迂回（auth-store.ts L39-49 のコメント参照）
- ログイン後の移行 (`utils/migration.ts`) は **local モードのまま** ローカル state を
  読み出し、`/api/migrate` に渡してから `setMode('server')` + `loadAll()` する流れ
- サーバモードでも CRUD は基本「楽観更新あり」のはずだが、`addItem` / `addDish` /
  `deleteCheckedItems` / `link*` / `unlink*` だけは `loadAll()` で再取得しており不揃い
- `reorder*` はサーバモードでは state を一切触らない。呼び出し側
  （`app/(tabs)/index.tsx` の `handleReorder*`）が `useShoppingStore.setState(...)`
  で先に並び替えてから `reorderXxx` を呼ぶ。失敗時は `loadAll()` でロールバック

## 設計案（要決定）

### 案 A: Backend (Repository) パターン

`ShoppingBackend` interface を切り、`LocalBackend`（no-op）と
`ServerBackend`（既存 `api/shopping`, `api/dishes`, `api/saved-recipes` を呼ぶ）を実装。
ストアのアクション本体は **state mutation 1 通り** にし、最後に `backend.xxx(...)` を
await する。`mode` フィールドの役割は backend 選択のためのフラグに退化する。

```ts
interface ShoppingBackend {
  loadAll(): Promise<{ items: ShoppingItem[]; dishes: Dish[] } | null>; // local は null
  createItem(name: string, category?: string): Promise<ShoppingItem | null>;
  // …各操作。local は no-op or null を返す
}
```

- 利点: 二重実装が文字通りなくなる。テストは「state の遷移」と「backend の呼び出し」を
  別々に検証できる。新モード（例: 端末間同期付きキャッシュ）を入れる余地が広がる
- 欠点: 抽象が 1 段増える。ID 採番（local は負の値、server は API 戻り値）の扱いは
  backend 側に逃がすことになるので、`createItem` 系は「サーバ ID で楽観更新」に揃える
  必要がある（後述の正規化と同時にやる）

### 案 B: 単一本体 + サーバ呼び出しゲート

mode 分岐を潰す代わりに backend 抽象は作らず、各アクションを
「state を更新する → server モードなら追加で API を叩く」の 2 ステップに揃える。

- 利点: 構造変更が最小。差分が読みやすい
- 欠点: アクションごとに `if (mode === 'server') await api.xxx(...)` が散在し続ける。
  「重複は減ったが分岐は残っている」状態。recipe-store にも同じことを書くので、
  共通化のうまみは案 A より小さい

### 案 C: local モード自体を廃止

サーバ必須にしてしまう案。ログイン前は read-only / モック。

- 利点: ストアは API 一本。最も単純
- 欠点: 「未ログインでも基本機能を使える」という既存の UX を壊す。スコープが大きすぎる
  ので **このリファクタの選択肢からは外す**（別タスクで意思決定するべき）

→ 第一候補は **案 A**。ただし案 A に進む前に「サーバモードの不揃いな挙動の正規化」
（Phase 2）を済ませておかないと、backend にロジックを切り出した瞬間に挙動が変わる
リスクがある。

## Phase / Step

### Phase 1: 監査とインベントリ作成（実装なし）

- [ ] 全アクションについて `local` / `server` のセマンティクスを表で並べる
  （optimistic vs loadAll-after / state を触るか / 失敗時のロールバック有無）
- [ ] 呼び出し側（`app/(tabs)/index.tsx`、`recipes.tsx`、`IngredientsScreen.tsx`、
  `use-dish-suggestions.ts`、`migration.ts`、`auth-store.ts`）からの依存表現を確認し、
  「ストアの API を変えると壊れるところ」を列挙
- [ ] テスト一覧（`__tests__/stores/shopping-store.test.ts` ほか）から、
  どのケースが local 専用 / server 専用 / 共通かを仕分け

### Phase 2: サーバモードの挙動正規化（リファクタ準備）

意図: backend 抽象を入れる前に、サーバモードの「loadAll-after」と「楽観更新」の
混在を片寄せする。原則 **全部楽観更新** とする（不要な GET を消す → 体感も改善）。

- [ ] `addItem` / `addDish`: API 戻り値の正規 ID で楽観 push、`loadAll()` を削除
- [ ] `deleteCheckedItems`: 削除対象 ID をローカルで把握 → API → 該当 ID を state から削除
- [ ] `linkItemToDish` / `unlinkItemFromDish`: API → state の `dish_id` 更新だけで済ませる
- [ ] `deleteDish`: 既に楽観に近い（API → loadAll）。loadAll を消して `deleteItem` と
  揃える
- [ ] テスト追加: 楽観更新後に state がどうなっているかを server モードでも assert
- [ ] 失敗時の挙動を整理: 現状ほぼ throw → 呼び出し側 Alert。ロールバックは入れない方針
  （UX 上の決定としてプランに明記）

### Phase 3: `ShoppingBackend` 抽象の導入

- [ ] `mobile/src/stores/backends/shopping-backend.ts` を新設し、interface と
  `LocalShoppingBackend` / `ServerShoppingBackend` を実装
- [ ] ストアは `mode` から backend を選び、アクション本体は単一に
- [ ] ID 採番（local の `nextLocalId`）は LocalBackend 内に閉じ込める
- [ ] `setMode` の役割は「保持データを切る + backend 切替」になるよう整理。
  ログアウト時の「データを残しつつ mode だけ戻す」迂回は引き続きサポート（テスト追加）

### Phase 4: recipe-store にも同じパターンを適用

- [ ] `RecipeBackend` 抽象を切る or `ShoppingBackend` を一般化して再利用
- [ ] `autoSaveRecipes` / `deleteSavedRecipe` / `loadSavedRecipes` を一本化

### Phase 5: テスト整理 & 動作確認

- [ ] `shopping-store.test.ts` を「state mutation のテスト」「backend 呼び出しのテスト」に
  再構成（mode 別の重複を削減）
- [ ] `migration.test.ts` が依然グリーンであることを確認（local→server の入口）
- [ ] Expo Go で実機/シミュレータ動作確認
  - 未ログイン状態の追加・編集・削除・並び替え
  - ログイン後（`/api/migrate` 経由）でデータが残っているか
  - ログアウト後にデータが画面に残るか（auth-store の意図的迂回が引き続き効くか）
  - AI 具材提案 → `dishes/<id>/ai-cache` への保存

## 影響範囲

- `mobile/src/stores/shopping-store.ts` （主対象）
- `mobile/src/stores/recipe-store.ts` （Phase 4）
- `mobile/src/stores/auth-store.ts` （`setState({ mode: 'local' })` の迂回が引き続き効く確認）
- `mobile/src/utils/migration.ts` （ローカル state 読み出しの API 形が変わらないか確認）
- `mobile/__tests__/stores/shopping-store.test.ts`
- `mobile/__tests__/stores/recipe-store.test.ts`
- `mobile/__tests__/utils/migration.test.ts`
- 副次的に `app/(tabs)/index.tsx` / `recipes.tsx` / `IngredientsScreen.tsx` でストア API
  シグネチャ変更があれば追従

## 非スコープ

- `app/(tabs)/index.tsx` の責務漏出整理（リファクタリング 9 / M2）。本タスクは
  **ストア側の整理に限定** し、画面が直接 API を叩いている箇所の畳み込みはやらない
- 認証フロー変更（passkeys 等）
- サーバ側 API の変更
- `local` モードを廃止するかどうかの戦略判断

## テスト方針

- 単体: `mobile/__tests__/stores/shopping-store.test.ts` を Phase 単位で更新。
  `LocalShoppingBackend` を直接インスタンス化してテストできるようにする
- 結合: `__tests__/utils/migration.test.ts` がそのままグリーンであることが
  「local→server 切替境界が壊れていない」ことの主要シグナル
- 手動: Expo Go で no-login / login / logout の 3 シナリオを通す

## 決定が必要な点

1. **抽象方針**（案 A / 案 B）— 第一候補は案 A。承認 or 別案でやり直し
2. **サーバモードを全部楽観に揃える方針**（Phase 2）の是非
   — 体感は良くなるが、API レスポンスを信用しなくなるので、サーバ側で
   生成されたフィールド（`created_at` 等）の楽観値が一時的にずれる
3. **失敗時にロールバックを入れるか**（現状ほぼ throw のみ）
   — 入れるなら抽象化のついでに各アクションでスナップショット → 失敗時 restore
