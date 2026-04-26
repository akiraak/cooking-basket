#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/mobile"

# LAN IP 自動検出（Linux: hostname -I の先頭 / macOS: ipconfig getifaddr en0|en1）
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

if ! command -v jq >/dev/null 2>&1; then
  echo "[mobile-build-local] jq が見つかりません。Ubuntu: 'apt install jq' / macOS: 'brew install jq'" >&2
  exit 1
fi

# eas.json を一時的に書き換え、終了時に必ず元に戻す
trap 'git checkout -- eas.json 2>/dev/null || true' EXIT
TMP=$(mktemp)
jq --arg url "$API_URL" '.build.preview.env.EXPO_PUBLIC_API_URL = $url' eas.json > "$TMP"
mv "$TMP" eas.json

eas build --profile preview --platform ios
