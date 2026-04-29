#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="$DIR/vibeboard/dist/cli.js"

if [ ! -f "$CLI" ]; then
  cat >&2 <<EOF
Error: $CLI が見つかりません。

vibeboard が未セットアップのようです。次の手順で用意してください:

  1. (初回のみ) cooking-basket 直下で:
       npx -y degit akiraak/vibeboard vibeboard
  2. vibeboard ディレクトリで依存をインストール (prepare で dist/ も生成):
       cd vibeboard && npm install

そのあと再度 ./dev-admin.sh で起動できます。
EOF
  exit 1
fi

exec node "$CLI" --root "$DIR" "$@"
