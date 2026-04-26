# 料理の具材が AI 再検索で「追加具材」に降格する問題の修正

## 目的・背景

ユーザー報告:
> 料理追加 → 具材を追加（春キャベツ）→ 料理画面 → 「この素材でレシピをAI検索」
> → 具材セクションに 春キャベツ＋他食材、レシピ 3 件が表示される
> → 「レシピをAI検索」 → 春キャベツが「追加具材（買い物リストから）」に表示される
> 本来は具材セクションのままが期待値

実際の挙動:
1. 初期表示: `dish.items=[春キャベツ]` / `ingredients=[]` → `extraIngredients=[春キャベツ]`
   → 「追加具材」セクションに 春キャベツ、ボタン「この素材でレシピをAI検索」
2. 1 回目クリック (`handleSearchWithExtras` → `fetchSuggestions(['春キャベツ'])`)
   → AI が extras に従って 春キャベツ を含む ingredients を返却
   → `setIngredients` で 春キャベツ が 具材 セクションへ昇格 / 追加具材 セクション消失
   → ボタン文言は「レシピをAI検索」(`extraIngredients.length === 0`) に変わる
3. 2 回目クリック (`handleRefresh` → `fetchSuggestions()` extras なし)
   → AI が extras なしで自由提案するため、料理名から 春キャベツ を必ず推測するとは限らず、
     ingredients に 春キャベツ が含まれない応答もある
   → `extraIngredients = dish.items \ aiNames` の再計算で 春キャベツ が再浮上
   → 「追加具材」 セクションに 春キャベツ が降格

### 根本原因

`mobile/src/components/dishes/IngredientsScreen.tsx`:
- L47-52: `extraIngredients` は **「unchecked の dish.items から AI 返り値の ingredients を引いた残り」** という派生値
- L139-145: `handleRefresh` / `handleSearchWithExtras` の 2 系統で extras を渡すか分岐
- 2 回目以降の refresh ボタンが `handleRefresh` に切り替わる (L362) ため、extras 無しで AI を再呼出 → AI 返り値次第で dish.items の項目が「追加具材」 に逆戻り

つまり「ユーザーが料理に紐づけた具材」が **AI の応答に依存して表示位置が揺れる** のが本質。
ユーザー視点では「料理の具材として登録した = 具材セクションに居続けるべき」が直感。

## 対応方針 (option A: pinnedExtras 化)

最もシンプル: `dish.items` の unchecked 名前一覧を **常に AI 呼出の extras に渡す** 形に統一する。

### 変更点

`IngredientsScreen.tsx`:
1. `pinnedExtras = useMemo(() => dish.items.filter(i => !i.checked).map(i => i.name), [dish.items])`
   を新設。これは「この料理の AI 提案に常に含めるべき具材」を表す source of truth。
2. `handleRefresh` と `handleSearchWithExtras` を 1 本化:
   ```ts
   const handleSearch = useCallback(() => {
     fetchSuggestions(pinnedExtras.length > 0 ? pinnedExtras : undefined);
   }, [fetchSuggestions, pinnedExtras]);
   ```
3. すべてのボタン `onPress` を `handleSearch` に置換 (L334, L325, L362)。
4. 表示用の `extraIngredients` (= 「まだ AI 応答に取り込まれていない dish.items」) は今のまま残す。
   - 初期表示 (AI 未呼出) では「追加具材」 セクションに表示してユーザーに何が pin されているか伝える役割を維持
   - AI 応答後は AI が pinnedExtras を必ず含むので extraIngredients は実質常に空になる
5. `refreshLabel` の分岐は維持 (`extraIngredients.length > 0` で「この素材で」 / それ以外で「レシピをAI検索」)

### 期待される挙動

- 初期: 追加具材=[春キャベツ] / 具材=[] → 「この素材でレシピをAI検索」
- 1 回目: AI が extras を尊重 → 具材=[春キャベツ, ...] / 追加具材=[] → 「レシピをAI検索」
- 2 回目: AI が再度 extras=[春キャベツ] で呼ばれる → 具材=[春キャベツ, ...] のまま安定
- ユーザーが dish.items から 春キャベツ を外したら pinnedExtras から消える (extras なしで AI 呼出 → 自由提案に戻る)

### 既知のトレードオフ

- 「dish に具材を残しつつ AI に縛られない自由提案を見たい」ユースケースは消える。
  必要になれば「pin を一時解除して再検索」ボタンを足す。発生頻度低と判断し、本プランでは入れない。
- `pinnedExtras` が大きくなると AI のレシピ提案が単調になる可能性。レシピ多様性を求める場合は別途対応。

## 影響範囲

- `mobile/src/components/dishes/IngredientsScreen.tsx` のみ
- store / API / サーバ側の変更なし（既存の `suggestAi(dishName, extraIngredients?)` インターフェイスをそのまま使う）

## テスト方針

### 単体・結合テスト
- RN コンポーネント描画テストは未導入のため、コンポーネント側の自動テストは追加しない
- store 層の `suggestIngredients` は既にテスト済み (`__tests__/stores/shopping-store.test.ts`)
- API 層の `suggestAi` は既にテスト済み (`__tests__/api/ai.test.ts`)
- 既存テストの差分は出ない見込み

### 手動確認シナリオ

1. **再現確認 (修正前)**
   - 料理「春キャベツのパスタ」追加 → 具材 春キャベツ 追加 → 料理画面
   - 「この素材でレシピをAI検索」 → 具材セクションに 春キャベツ
   - 「レシピをAI検索」 → 追加具材セクションに 春キャベツ が逆戻り (bug 再現)

2. **修正後**
   - 同シナリオで 「レシピをAI検索」 を何度押しても 春キャベツ が 具材 セクションに残る

3. **dish.items 編集後**
   - 春キャベツ を dish から外す → pinnedExtras=[] → 「レシピをAI検索」 押下で extras なしの AI 呼出
   - 自由提案が返る

4. **未認証 (AiQuotaError) 経路**
   - 残量切れ時に `requestLogin` 経由でログインモーダルが出て、`onSuccess` で同じ extras 付き再呼出になる

5. **キャッシュ復元**
   - `dish.ingredients_json` / `recipes_json` がある状態で画面を開いても、初期表示は今までと変わらない
