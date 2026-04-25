# TODO

## 機能開発
- [ ] AI 取得フローを「レシピ取得 1 系統」に統一し、`createDish` の同名キャッシュ継承を廃止（[docs/plans/unify-ai-suggest-flow.md](docs/plans/unify-ai-suggest-flow.md)）
  - [ ] Phase 3: クライアント側 API / ストア（`SuggestAiMode` 型・`mode` 引数・`getDishSuggestions` / `getItemSuggestions` を削除、書き戻しロジックは維持）
  - [ ] Phase 4: `IngredientsScreen` の表示ロジック（専用ボタン削除、`refreshLabel` を 2 文言に統合、empty 状態でも `extraIngredients` があれば追加素材セクション表示、ローディング文言を「AI で検索中...」に変更）
  - [ ] Phase 5: クライアント側テスト更新（`mode='ingredients'` / `mode='recipes'` 関連テスト削除、`getDishSuggestions` / `getItemSuggestions` モック削除）
  - [ ] Phase 6: 動作確認（empty 状態 / 追加素材あり / 同名再登録 / 旧クライアント互換 / 削除済みルート 404 / admin 購入履歴）
- [ ] アプリ起動直後は右上ハンバーガーのAI使用回数が表示されない
- [ ] 自分のレシピに表示されるレシピの判定基準の調査
- [ ] ライトモードのデザイン追加
- [ ] passkeys認証対応
- [ ] オフラインの時にローカルで変更を保存しておきオンラインになったときに更新
- [ ] アイテム編集ダイアログから削除を削除
- [ ] basket@chobi.me を使えるようにする
- [ ] サービスの状況をメールで定期報告
- [ ] 料理レシピページの料理名をページの「買い物リスト」の表示の場所を差し替えて
- [ ] 買い物リスト画面でレシピ料理を生成中は読み込みのアニメーションを表示して
- [ ] 料理レシピページのステップを見るのなかのテキストが画面右端からはみ出てる
- [ ] ハートをフラットなイラストに
- [ ] Google認証を他のアカウントでチェック
- [ ] アプリアイコンのボールをバスケットに
