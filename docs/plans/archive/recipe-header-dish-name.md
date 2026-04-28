# 料理レシピページのヘッダーに料理名を表示する

## 目的・背景

`(tabs)/index.tsx` から料理を開くと `IngredientsScreen` が `StyleSheet.absoluteFill`
で画面コンテンツ領域にオーバーレイ表示される。このとき:

- 上端の **ネイティブタブヘッダー** には依然として「買い物リスト」と表示される
  （`mobile/app/(tabs)/_layout.tsx:49` で `Tabs.Screen.options.title` に固定）
- そのすぐ下に `IngredientsScreen` 自身の **カスタムヘッダー** が
  `← 戻る` と `<DishNameHeader />`（料理名 + ✎ 編集アイコン）を並べる
  （`mobile/src/components/dishes/IngredientsScreen.tsx:169-180`）

結果として「買い物リスト」と料理名の 2 段ヘッダーになり、いまどの画面を見ているのかが分かりにくい。
ユーザー要望は **「料理レシピページの料理名を、画面上の『買い物リスト』の代わりに同じ場所
（＝ネイティブタブヘッダーのタイトル位置）に表示する」**。

## 対応方針

`activeDish` が立っている間だけ、ネイティブタブヘッダーの `title` / `headerLeft` を
`navigation.setOptions` で差し替え、`IngredientsScreen` 側のカスタムヘッダーを撤去する。

ルート構造そのものは変えない（オーバーレイ方式は維持する）。expo-router の Stack 化は
スコープ外。今回は「タイトル文字列の差し替え」だけで要望を満たせる。

### 具体的な変更点

1. **タイトル差し替えを `(tabs)/index.tsx` で行う**
   - `useNavigation()` を取り、`activeDish` の有無に応じて `useLayoutEffect` で
     `navigation.setOptions({ title, headerLeft, headerTitle })` を呼ぶ
   - `activeDish` 解除時には `title: '買い物リスト'` / `headerLeft: undefined` に戻す
   - タイトル位置で料理名を編集できる挙動は維持したいので、
     `headerTitle: () => <DishNameHeader dish={activeDish} />` で既存コンポーネントを再利用する
   - `headerLeft: () => <BackButton onPress={...} />` で「← 戻る」をネイティブヘッダーに移す
     （ハンドラは現行 `IngredientsScreen` の `handleClose` と同等：`loadAll()` → `setActiveDish(null)`）

2. **`IngredientsScreen` からカスタムヘッダーを撤去する**
   - `mobile/src/components/dishes/IngredientsScreen.tsx:169-180` の `<View style={styles.header}>...</View>` ブロックと、
     関連する `header` / `headerSide` / `backBtn` スタイル、`onClose` prop を削除
   - 戻る操作の責務は呼び出し元（`(tabs)/index.tsx`）の `headerLeft` に移る
   - `onClose` を受け取る理由が無くなるため、props も整理する

3. **`DishNameHeader` の見た目調整（必要に応じて）**
   - 現状はカスタムヘッダー内で中央寄せ（`flex: 1` + `alignItems: 'center'`）になっている
   - ネイティブヘッダーの `headerTitle` スロット内では幅制約が異なるため、
     実機/Expo Go で見て破綻があれば `styles.titleBtn` の `flex: 1` を外す等の微調整を行う
   - 編集モードの `TextInput` 幅も同様に確認

4. **タブバー（下部）は触らない**
   - 現状もレシピページ表示中にタブバーは見えており、ユーザー要望にも言及がない
   - 今回のスコープ外

## 影響範囲

- `mobile/app/(tabs)/index.tsx` — `useLayoutEffect` で `navigation.setOptions`、`<IngredientsScreen>` 呼び出しから `onClose` 削除
- `mobile/src/components/dishes/IngredientsScreen.tsx` — カスタムヘッダー削除、`onClose` prop 削除、未使用スタイル整理
- `mobile/src/components/dishes/DishNameHeader.tsx` — 必要なら見た目微調整のみ（ロジック変更なし）

サーバ側・ストア・API の変更は無し。

## テスト方針

- **既存自動テスト**: `mobile/__tests__/` 配下に `IngredientsScreen` / `DishNameHeader` の
  描画テストは無いため、新規追加は不要。`npm test` が通ることだけ確認する。
- **手動確認 (Expo Go)**:
  - 買い物リスト画面でヘッダーが「買い物リスト」のままであること
  - 料理を開いたら、ネイティブヘッダーのタイトルが料理名（編集可能 ✎ つき）に切り替わること
  - 「← 戻る」がネイティブヘッダー左に出て、押すと買い物リストに戻り、ヘッダーが「買い物リスト」に戻ること
  - 料理名タップ → インライン編集 → 保存／キャンセルが正常に動くこと
  - 別タブ（レシピノート）に切り替えても買い物リストタブのタイトルが正しく復帰すること
  - メニュー（☰）は両画面で `headerRight` に出続けること
- ライト／ダーク両モードでヘッダーの視認性を確認

## 進め方（Phase 分け）

単一 PR で十分な小ささのため Phase 分けはしない。
作業順は ①プラン作成 → ②`(tabs)/index.tsx` で `setOptions` を組む → ③`IngredientsScreen` のヘッダー削除
→ ④Expo Go で実機確認 → ⑤`npm test` → ⑥コミット。
