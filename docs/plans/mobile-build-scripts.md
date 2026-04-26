# モバイルアプリのビルドスクリプト整備

## 目的
Expo / EAS でのモバイルアプリのビルド手順を、3 種類のスクリプトにまとめて
誰でも同じ操作で実行できるようにする。

1. **ローカルサーバ接続ビルド** — 実機テスト用。LAN 上の `npm run dev` サーバに接続する preview ビルド
2. **本番サーバ接続ビルド** — `https://basket.chobi.me` に接続する production ビルド（提出はしない）
3. **TestFlight アップロード** — 直近の production ビルドを TestFlight に提出

すべて **iOS のみ** を対象にする。

## 背景・現状
- `mobile/eas.json` の `preview` / `development` プロファイルには
  `EXPO_PUBLIC_API_URL=http://192.168.x.x:3000` というプレースホルダ値が入っており、
  そのままでは実機ビルドが LAN サーバに到達できない。
- ローカル `expo start` は `mobile/.env` を読むので動くが、EAS クラウドビルドは
  `mobile/.env` を読まない（`eas.json` の `env` か EAS Cloud secret しか参照されない）。
- そのため「ローカルサーバ接続のビルド」を作るには、ビルド前に `eas.json` の env を
  実 IP に差し替える必要がある。
- `production` プロファイルには env 未指定で、`api-endpoint.ts` のフォールバック
  （`https://basket.chobi.me`）が効く構成になっている。
- TestFlight 提出は `eas submit -p ios --latest` で可能（`eas.json` の
  `submit.production.ios.ascAppId` は設定済み）。

## 実装方針
- スクリプトは **プロジェクトルート (`/home/ubuntu/cooking-basket/`)** に
  シェルスクリプトとして配置する（既存 `server-dev.sh` / `dev-admin.sh` と同じパターン）。
- 各スクリプトは `cd "$(dirname "$0")/mobile"` してから `eas` を呼ぶ。
- ローカル IP は **自動検出**（Linux: `hostname -I` の先頭 / macOS: `ipconfig getifaddr en0|en1`）。
  検出できなければエラー終了。
- `eas.json` のローカル IP プレースホルダは削除し、ビルド時に `mobile-build-local.sh` が
  一時的に `eas.json` を書き換える。終了時に `trap` + `git checkout -- eas.json` で
  元に戻し、コミット汚染を防ぐ。
- TestFlight 提出は **直近 production ビルドの提出** (`eas submit -p ios --latest`)
  に固定する（ビルド + 自動提出は使わない）。
- Android は当面対象外（必要になった時点で別タスクで追加）。

## スクリプト構成

### `/home/ubuntu/cooking-basket/mobile-build-local.sh`（新規）
LAN IP を自動検出して preview プロファイルでビルドする。

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/mobile"

# LAN IP 自動検出（Linux: hostname -I / macOS: ipconfig getifaddr en0|en1）
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$IP" ]; then
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
fi
if [ -z "$IP" ]; then
  echo "[mobile-build-local] LAN IP を検出できませんでした" >&2
  exit 1
fi

API_URL="http://${IP}:3000"
echo "[mobile-build-local] EXPO_PUBLIC_API_URL=${API_URL}"

# eas.json を一時的に書き換え、終了時に必ず元に戻す
trap 'git checkout -- eas.json 2>/dev/null || true' EXIT
TMP=$(mktemp)
jq --arg url "$API_URL" '.build.preview.env.EXPO_PUBLIC_API_URL = $url' eas.json > "$TMP"
mv "$TMP" eas.json

eas build --profile preview --platform ios
```

### `/home/ubuntu/cooking-basket/mobile-build-prod.sh`（新規）
本番サーバ接続の production ビルド（提出はしない）。

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/mobile"
exec eas build --profile production --platform ios
```

### `/home/ubuntu/cooking-basket/mobile-submit-testflight.sh`（新規）
直近の production ビルドを TestFlight に提出。

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/mobile"
exec eas submit --platform ios --latest
```

### `mobile/eas.json` の修正
- `preview` / `development` の `EXPO_PUBLIC_API_URL` プレースホルダ値を削除する
  （ビルド時に `mobile-build-local.sh` が注入する。ルート以外から `eas build --profile preview`
  を直叩きした場合は env なしで `https://basket.chobi.me` フォールバックになる ＝
  ローカル接続したいなら必ずスクリプト経由で叩く運用にする）。

## 使い方

```bash
# 自宅 LAN のサーバに接続する preview ビルド（実機テスト用）
./mobile-build-local.sh

# 本番サーバ接続の production ビルド（TestFlight には出さない）
./mobile-build-prod.sh

# 直近の production ビルドを TestFlight にアップロード
./mobile-submit-testflight.sh
```

## 影響ファイル
- `mobile-build-local.sh`（新規、実行権限付き）
- `mobile-build-prod.sh`（新規、実行権限付き）
- `mobile-submit-testflight.sh`（新規、実行権限付き）
- `mobile/eas.json`（preview/development の env プレースホルダを削除）
- `README.md`（使い方を 1 段落追記）

## 非スコープ（やらないこと）
- Android のビルド／Google Play 提出スクリプト（必要になったら別タスク）
- App Store 本提出（`mobile-submit-testflight.sh` までで止める）
- ビルド + 自動提出ワンショット（`--auto-submit`）
- バージョン番号の自動更新（`production.autoIncrement: true` で EAS 側に任せる）
- CI への統合
- `expo prebuild` まわり（managed workflow のまま）

## テスト方針
- **ユニットテスト**: シェルスクリプトなので追加なし。
- **動作確認**:
  1. `./mobile-build-local.sh` を流して、ビルド開始時のログに自宅 LAN IP の URL が出ること
  2. ビルド成果物を実機にインストールしてローカルサーバにアクセスできること
  3. 終了時 `git status` で `mobile/eas.json` に差分が残らないこと（trap が効いている）
  4. `./mobile-build-prod.sh` で `https://basket.chobi.me` に向く production ビルドが出ること
  5. `./mobile-submit-testflight.sh` で直近 production ビルドが TestFlight にアップロードされること

## フェーズ

### Phase 1: スクリプト追加と eas.json 整理
- [ ] `mobile-build-local.sh` を作成し `chmod +x`
- [ ] `mobile-build-prod.sh` を作成し `chmod +x`
- [ ] `mobile-submit-testflight.sh` を作成し `chmod +x`
- [ ] `mobile/eas.json` から preview/development の `EXPO_PUBLIC_API_URL` プレースホルダを削除
- [ ] `jq` の前提を README に注記（macOS は `brew install jq`、Ubuntu は `apt install jq`）

### Phase 2: 動作確認
- [ ] `./mobile-build-local.sh` を実機向けに走らせ、LAN サーバへ接続できることを確認
- [ ] `./mobile-build-prod.sh` で本番接続ビルドが取れることを確認
- [ ] `./mobile-submit-testflight.sh` で TestFlight に上がることを確認
- [ ] 実行後 `git status` に `mobile/eas.json` の差分が残らないことを確認

### Phase 3: ドキュメント
- [ ] README に 3 つのスクリプトの使い方を追記
