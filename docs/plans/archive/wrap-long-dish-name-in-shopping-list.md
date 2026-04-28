# 買物リストの料理名が長い場合に複数行で表示する

## 目的・背景

買物リスト画面で料理（dish）グループのヘッダに表示される料理名は、現在 `numberOfLines={1}` により 1 行に切り詰められて省略表示される。料理名が長いと末尾が `...` で隠れてしまい、ユーザーが何の料理か判別しづらい。長い料理名はラップして複数行で全文表示できるようにする。

ユーザー要望（`TODO.md` 機能開発セクション）:
> 買物リストでの料理名が長かった場合に複数行に

## 現状

- 料理名の描画: `mobile/src/components/shopping/DishGroup.tsx:83`
  ```tsx
  <Text style={[styles.dishName, { color: colors.primaryLight }]} numberOfLines={1}>
    {dish.name}
  </Text>
  ```
- ヘッダ行のレイアウト: `DishGroup.tsx:81-95`
  - 親 `header`（`flexDirection: 'row'`, `alignItems: 'center'`、147-150 行）
  - 左: `dishNameArea`（`TouchableOpacity`、`flex: 1`、152-154 行）に料理名 `Text`
  - 右: `headerButtons`（`flexDirection: 'row'`, `gap: 12`、159-162 行）に `+` / `×` ボタン
- `dishName` スタイル: `DishGroup.tsx:155-158`（`fontSize: 16`, `fontWeight: '600'`、幅制約なし）

`dishNameArea` がすでに `flex: 1` を持っているので、`numberOfLines={1}` を外すだけで右側のボタン分の幅を除いた領域に折り返して表示される。`alignItems: 'center'` により、ラップして高さが増えても `+` / `×` ボタンは縦中央に保たれる。

### 他の料理名表示箇所
`grep numberOfLines` で確認した結果、買物リスト UI で料理名に `numberOfLines={1}` を付けている箇所は:
- `DishGroup.tsx:83` ← 今回対象
- `AddModal.tsx:141` — アイテム追加/編集ダイアログの「料理選択チップ」内の料理名。チップは横並びでコンパクトに見せたい UI なので、このままにしておく（対象外）

## 対応方針

### 単一 Phase（小規模変更）

`mobile/src/components/shopping/DishGroup.tsx:83` の `Text` から `numberOfLines={1}` を削除する。

```diff
- <Text style={[styles.dishName, { color: colors.primaryLight }]} numberOfLines={1}>
+ <Text style={[styles.dishName, { color: colors.primaryLight }]}>
    {dish.name}
  </Text>
```

それ以外のスタイル（`dishName`, `dishNameArea`, `header`, `headerButtons`）は変更不要。`flex: 1` と `alignItems: 'center'` のおかげで折り返しと縦位置調整は自動で機能する。

### 検討して見送り

- **行数上限を設ける（例: `numberOfLines={3}`）**: いまは長さ制限がない料理名フィールドなので、極端に長い名前が来るとヘッダが縦に伸びすぎる懸念はある。ただし料理名は AI 生成 or 手入力で実用上 1〜2 行に収まるはずで、まず制限なしで様子を見る。実運用で破綻するケースが出たら追って `numberOfLines={3}` を入れる。
- **`AddModal` のチップ側もラップする**: チップは横並びコンパクト表示が前提（複数並ぶ）なのでラップさせると全体が崩れる。今回の TODO の対象外なので触らない。

## 影響範囲

- 機能面: 買物リスト画面の各料理グループ・ヘッダで料理名がラップ表示されるようになる
- レイアウト: 長い料理名のとき、ヘッダ行の高さが従来 1 行ぶんから複数行ぶんに増える。`+` / `×` ボタンは `alignItems: 'center'` で縦中央に保たれる
- 互換性: コンポーネント API・ストア・サーバへの影響なし
- データ: 影響なし

## テスト方針

- 既存の Jest テスト（`mobile/__tests__/`）は `DishGroup` の描画テスト未導入のため、テスト追加は不要（プロジェクト方針として RN 描画テストは no-login 移行後に検討と CLAUDE.md にある）
- `cd mobile && npm test` で既存テストが緑のままであることを確認
- `npx expo start` で Expo Go 起動し、以下を実機で確認:
  1. 通常の短い料理名（例: 「カレー」）が従来どおり 1 行で表示される
  2. 長い料理名（例: 「鶏むね肉と季節野菜のグリル バルサミコソース添え」）が 2 行以上にラップされて全文見える
  3. ラップ時も `+` / `×` ボタンが縦中央に配置される
  4. 料理名タップで `onPressDishName`（料理メニュー）が従来どおり開く
  5. ドラッグ＆ドロップ時のレイアウトが破綻しない

## 完了後の後片付け

- `TODO.md` の該当項目を `DONE.md` に移動（完了日: 移動した日）
- このプランファイルを `docs/plans/archive/` に移動
