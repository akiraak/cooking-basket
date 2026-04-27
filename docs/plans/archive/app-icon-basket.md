# アプリアイコンのお椀→バスケット差し替え

## 目的・背景

現在のアプリアイコンは「お椀（ボウル）に食材＋チェックマーク」のデザインだが、
アプリ名「お料理バスケット」に合わせて、容器部分を**バスケット（編み目のかご + 持ち手）**
へ差し替える。新アイコンはユーザーから提供済み。

- 新アイコン素材: `cooking-basket-icon.png`（リポジトリルート、1254×1254 PNG、白背景）
  - ユーザーは「`/home/ubuntu/cooking-basket-icon.png` に置いた」と伝えてきたが、
    実体はプロジェクトルート `/home/ubuntu/cooking-basket/cooking-basket-icon.png` にある
- デザイン継続性: 既存アイコン（オレンジ単色、食材＝牛乳パック・りんご・ワイン・バゲット、
  チェックマーク）はそのまま踏襲され、容器のみがお椀→バスケットに変わっている

TODO: `アプリアイコンのボールをバスケットに`（"ボール" は "ボウル/お椀" の意）

## 対応方針

差し替え対象のアセットは複数サイズ・複数形状（正方形 / OGP 横長 / Android 適応マスク）に
分かれているため、新素材から各サイズを生成して上書きする。

既存アセットの寸法・配置・背景色を踏襲し、**素材以外のメタ情報（version, bundleId,
app name 等）は変更しない**。

### 生成方針（ImageMagick で機械生成、手動レタッチなし）

| 出力ファイル | サイズ | 余白方針 | 背景 |
|---|---|---|---|
| `mobile/assets/icon.png` | 1024×1024 | 素材をそのままリサイズ（既存と同じ密度） | 白 |
| `mobile/assets/adaptive-icon.png` | 1024×1024 | **66% safe zone** に収まるよう内側に約 17% パディングを追加 | 透過（`adaptiveIcon.backgroundColor = #ffffff` 側で塗る） |
| `mobile/assets/splash-icon.png` | 1024×1024 | `icon.png` と同じ（`resizeMode: contain` で `#1c1c1c` の上に表示される） | 透過 or 白（splash 側の `backgroundColor` で吸収） |
| `mobile/assets/favicon.png` | 48×48 | 縮小（現在は 8-bit gray+alpha のキューブ画像で、デザインがそもそも別物。今回オレンジのバスケットへ統一） | 透過 |
| `web/img/icon-192.png` | 192×192 | リサイズのみ | 白 |
| `web/img/ogp.png` | 1200×630 | 既存と同じく中央にアイコン配置、左右に余白（高さ 630 の 60% 程度を目安） | 白 |

> Android adaptive icon は 108dp のうち中央 66dp が safe zone（端は OS のマスク
> 形状で切り取られる）。新素材は端ギリギリまで描かれているので、そのまま使うと
> 持ち手や食材が欠ける可能性が高い。adaptive-icon 専用に外側パディングを足す。

### 触らない

- `mobile/assets/icon_dish.png` — レシピタブの FAB 内アイコン
  （`mobile/app/(tabs)/index.tsx:395`）。**アプリアイコンとは別物**。今回の
  差し替え対象外。
- `mobile/app.json` — アイコンへのパス（`./assets/icon.png` 等）は同じファイル名で
  上書きするため変更不要。`expo.version`、`bundleIdentifier`、`package` も維持。
- `server/tests/integration/app-routing.test.ts:36-39` — `/img/icon-192.png` が
  200 を返すことを期待しているテスト。ファイル名・パスは変えないので影響なし。
- Bundle ID / Expo project ID / app name / splash background color。
- ストア掲載スクリーンショット（メモリにあるアプリ公開 Step3 の TODO）— アイコンは
  メタデータ更新で別途差し替えるため、本タスクの守備範囲外。

## 影響範囲

### 上書きするファイル（バイナリ差し替え）
- `mobile/assets/icon.png`
- `mobile/assets/adaptive-icon.png`
- `mobile/assets/splash-icon.png`
- `mobile/assets/favicon.png`
- `web/img/icon-192.png`
- `web/img/ogp.png`

### 削除（任意）
- リポジトリルートの `cooking-basket-icon.png` — 各アセット生成後は不要なので
  削除する（ユーザーに確認のうえ）。

### コード変更なし
- 参照側 (`mobile/app.json`, `web/about.html:330`, `web/about.html:12,16`) は
  パス変更がないため修正不要。

## テスト方針

- **既存テストへの影響**: なし想定だが念のため
  - `cd server && npm test` — `app-routing.test.ts` がアセット 200 OK を維持しているか
  - `cd mobile && npm test` — Jest は画像参照を見ていないので素通りのはず
- **手動確認（モバイル）**:
  - `cd mobile && npx expo start` で起動 → Expo Go / Simulator のホーム画面に
    表示されるアイコンが新デザインになっているか確認
  - splash 画面（起動直後）が `#1c1c1c` 上にバスケットアイコンが中央配置されているか確認
  - Android: adaptive icon が円 / 角丸スクエア / ティアドロップ等のマスクで
    持ち手・食材が欠けていないか
- **手動確認（Web）**:
  - `web/about.html` をブラウザで開き、`<img src="img/icon-192.png">` が新デザインで
    表示されるか
  - OGP は Twitter Card Validator か `og:image` のローカル表示で中央配置を確認
- **EAS ビルド**: 本タスクではビルドしない。ストア配布アイコンは次回
  `eas build -p ios/android --profile production` 時に焼き直される。ストア掲載中の
  アイコンが切り替わるのは次回 `eas submit` 後となる旨を `DONE.md` 移行時に注記。

## Phase / Step

### Phase 0: 事前確認
- [ ] 新素材 `cooking-basket-icon.png` をプレビューし、デザイン・色味・余白が
      既存アイコンの世界観に合っているか目視確認
- [ ] 既存 6 アセットの寸法・透過/不透明・背景色を本プランの表通りか再確認
- [ ] ユーザーに「ルートの `cooking-basket-icon.png` は生成後に削除して良いか」
      を確認

### Phase 1: モバイル用 4 アセット差し替え
- [ ] `mobile/assets/icon.png` を 1024×1024 で生成・上書き
- [ ] `mobile/assets/adaptive-icon.png` を safe zone 内に収めて 1024×1024 で生成・上書き
- [ ] `mobile/assets/splash-icon.png` を 1024×1024 で生成・上書き
- [ ] `mobile/assets/favicon.png` を 48×48 で生成・上書き
- [ ] `git diff --stat` で 4 ファイル更新を確認

### Phase 2: Web 用 2 アセット差し替え
- [ ] `web/img/icon-192.png` を 192×192 で生成・上書き
- [ ] `web/img/ogp.png` を 1200×630（中央配置）で生成・上書き

### Phase 3: 動作確認
- [ ] `cd server && npm test` を流し、`app-routing.test.ts` が緑のままであることを確認
- [ ] `cd mobile && npm test` を流す
- [ ] `npx expo start` でモバイルのホーム / splash / adaptive を実機 or
      Simulator で目視確認
- [ ] `web/about.html` をブラウザで開き、表示アイコンと OGP（Open Graph 用 meta）が
      新デザインに更新されていることを確認

### Phase 4: 後片付け
- [ ] ルートの `cooking-basket-icon.png` を削除（Phase 0 で同意取得済みの場合）
- [ ] `TODO.md` の「アプリアイコンのボールをバスケットに」を `DONE.md` へ移し、
      `YYYY-MM-DD` 形式で完了日を付ける
- [ ] 本プランファイルを `docs/plans/archive/` に移動
- [ ] DONE.md 側に「ストア掲載アイコンの差し替えは次回 `eas build` /
      `eas submit` で反映」と注記
