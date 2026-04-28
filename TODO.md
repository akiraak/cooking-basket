# TODO

> 作業が完了した項目を DONE.md に移動する。docs/plans/ にプランファイルがある場合は docs/plans/archive に移動させる。

## 機能開発
- [ ] passkeys認証対応の検証 [plan](docs/plans/passkeys-auth-verification.md)
  - [ ] Phase 0: 事前確認（Team ID / 端末 OS / .well-known 配信ルート / モバイル Google OAuth 現状）
  - [ ] Phase 1: 技術調査（ライブラリ選定・メンテ状況・Cloudflare 配信ベストプラクティス）
  - [ ] Phase 2: AASA / assetlinks の試験配信と validator 通過確認（Phase 1 と並行可）
  - [ ] Phase 3: モバイル PoC（development build で登録・認証往復、iOS/Android 両 OS）
  - [ ] Phase 4: サーバ PoC（@simplewebauthn/server 組み込み、unit + 実鍵 integration test）
  - [ ] Phase 5: 共存設計と Go / Go-with-conditions / No-Go 判定 → 本実装プラン目次の作成
- [ ] 料理レシピページの料理名をページの「買い物リスト」の表示の場所を差し替えて
- [ ] アイテム編集ダイアログから削除を削除
- [ ] basket@chobi.me を使えるようにする
- [ ] サービスの状況をメールで定期報告

- [ ] ログイン中でオフライン状態の時の挙動のチェック
- [ ] クライアントの画面下タブメニューの「買い物リスト」はアイコンは暗く「レシピノート」は明るくどちらが選択されているのか分かりにくい
- [ ] 買い物リスト画面でレシピ料理を生成中は読み込みのアニメーションを表示して
- [ ] ライトモードのデザイン追加
- [ ] 料理レシピページのステップを見るのなかのテキストが画面右端からはみ出てる

## 開発管理画面
- [ ] 開発管理画面の機能だけど切り出して他のプロジェクトからもすぐ使えるようにする
- [ ] plansでアーカイブにしたら即アーカイブに移動した表示に反映して

