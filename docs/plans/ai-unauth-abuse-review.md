# 未ログイン AI 呼び出しのセキュリティ・コスト面リスク調査

## 目的・背景

`/api/ai/suggest` は `optionalAuth` + `rateLimitAi` の構成で、**未ログイン（ゲスト）でも叩ける**状態で本番稼働している。
ティア境界としては意図通り（[feature-tier-matrix.md](feature-tier-matrix.md) 参照）だが、
攻撃者視点で「現状の防御で本当に十分か」「Gemini 課金が青天井になり得るシナリオはないか」を
体系的にレビューしたことがない。

本タスクは **コードに手を入れる前の調査・整理フェーズ**。アウトプットは「リスク表 + 推奨対策の優先度付きリスト」で、
そこから実装が必要なものを別プランに切り出す。

## 現状の把握（コード時点のサマリ）

実コードから機械的に拾える事実だけ列挙する。判断は次セクション以降。

- ルーティング (`server/src/app.ts:91`):
  - `app.use('/api/ai', optionalAuth, aiRouter)` — JWT があれば検証、無ければ素通し
  - グローバル `cors()` で全 Origin 許可。`Origin` / `Referer` チェックなし
- 認可ミドルウェア (`server/src/middleware/rate-limit-ai.ts`):
  - キー算出: ログイン → `user:<userId>` / 未ログイン → `device:sha256(rawDeviceId + DEVICE_ID_SECRET)`
  - `X-Device-Id` ヘッダ未送信は 400。**値は任意の文字列で受理**（フォーマット検証なし）
  - 上限超過は 429 `ai_quota_exceeded`、加算は SQLite の UPSERT（同一プロセス内シングルライタ前提）
  - JST 00:00 に日次リセット
- 上限値 (`server/src/services/settings-service.ts`):
  - デフォルト ゲスト 3 / ユーザー 20、admin から `app_settings` で書換可。上限の絶対上限は `MAX_AI_LIMIT = 100000`
- バックエンド (`server/src/services/gemini-service.ts`):
  - `GEMINI_MODEL` 既定 `gemini-3.1-flash-lite-preview`。タイムアウト・リトライ制御なし
  - プロンプトはユーザー入力 `dishName` と `extraIngredients` を埋め込み（`server/src/services/dish-ai.ts:20`）
- IP ベースのレート制限・CAPTCHA・プルーフオブワーク・bot 対策ヘッダ検査は **無し**

## 調査範囲（対象とするリスク）

以下を 1 件ずつ「再現性 / 影響度 / 既存緩和の有無」で評価する。

### A. クォータ回避（不正利用）

1. **デバイス ID ローテーション**
   `X-Device-Id` を毎回ランダム生成すれば 1 IP からでも事実上無制限に叩ける。`DEVICE_ID_SECRET` はハッシュのソルトでしかなく、攻撃者は元 ID を知っているのでソルトの意味は薄い。
2. **CORS 全開 + 認証不要**
   `https://basket.chobi.me/api/ai/suggest` を任意の Web ページから fetch 可能。第三者サイトから無料の Gemini プロキシとして使える可能性。
3. **JWT 偽装/共有**
   `optionalAuth` は不正トークンを単に無視するだけなので「ユーザー枠（20回）に登った」状態を偽れない。ただし正規ユーザー間でトークン共有された場合は枠を共有する形になる（重大度低）。
4. **並行リクエスト時の二重計上 / 二重消費**
   SQLite UPSERT 周りの check-then-act が並列で走った場合、上限を 1〜数回オーバーラン可能か（書込み自体は順次でも、読取 → 上限判定 → 書込のレースで 1 リクエスト分の漏れは起こり得る）。

### B. プロンプトインジェクション / 出力経由の悪用

5. **`dishName` / `extraIngredients` への悪意あるプロンプト**
   `dish-ai.ts:20` の埋め込みは plain string 連結。「以下の指示を無視して〜」系で出力 JSON を破壊できるが、`parseDishInfo` は失敗時 `{ ingredients: [], recipes: [] }` を返すだけ（`dish-ai.ts:84`）。**サーバ側に影響は無いが、Gemini トークンは消費される**点をコスト面で評価。
6. **長大入力によるトークン爆発**
   `dishName` は文字数バリデーションなし。数十 KB の文字列を送ればプロンプトが膨らみ Gemini 側の入力トークンが跳ねる。出力トークンは構造化 JSON で頭打ちだが入力で課金されるので影響あり。

### C. コスト・運用

7. **モデル切替の意図せぬコスト増**
   `GEMINI_MODEL` env が未設定でも `gemini-3.1-flash-lite-preview` がデフォルト。これは preview 期間中無料想定（`feature-tier-matrix.md` 注記）だが preview 終了後に自動課金開始するリスクあり。env 値の取り違えで Pro 系を選んだ際の予算ガードもない。
8. **Gemini 側エラー時のリトライストーム**
   `askGemini` はタイムアウト・リトライ無し。Gemini 側 5xx 連発時にクライアントが愚直にリトライすればクォータだけ消費する展開もある（`rateLimitAi` は **成功/失敗に関わらず** 加算するので、これは攻撃というよりユーザー体験劣化と「失敗に課金される」問題）。
9. **管理画面で上限値を不適切に上げた場合の暴発**
   `MAX_AI_LIMIT = 100000`。ゲスト枠を誤って 100000 にされても止める仕組みが無い。

### D. 観測性

10. **異常検知の基盤が無い**
    `ai_quota` テーブルからは「key 単位の日次回数」しか見えない。IP・User-Agent・Origin が記録されていないため、悪用が起きても気付く手段が乏しい。
11. **ログから攻撃を判定できるか**
    `pino-http` の構造化ログには req.id / path / status は乗るが、429 多発の集計ダッシュボードは未整備。

## 対応方針（調査の進め方）

1. **静的レビュー**: 上記 A〜D を一件ずつ「現状の挙動」「攻撃手順の最短経路」「既存緩和」「未対策範囲」で表に起こす
2. **実機再現（必要に応じて）**: 開発サーバで再現可能なものは curl / fetch で実証
   - デバイス ID ローテーションでの上限回避（A-1）
   - 第三者 Origin からの fetch が通ること（A-2）
   - 並列リクエストでの上限オーバーラン（A-4）— 実害があるかの判定だけ
3. **コスト試算**: `gemini-3.1-flash-lite-preview` 公式単価（preview 終了後想定）と、想定攻撃シナリオ（1 端末あたり 1000 req/日 を 100 端末から）で月額レンジを出す
4. **対策案の比較表**: 各リスクに対して以下を並べる
   - **やらない（受容）**: なぜ受容して良いか
   - **軽量対策**: IP ベースの追加バケット / Origin allow-list / `dishName` 文字数制限 / express-rate-limit 導入
   - **重対策**: CAPTCHA / Cloudflare Turnstile / 未ログインの AI 完全廃止（ティア設計に影響）
5. **アウトプット**: 既存の `feature-tier-matrix.md` と整合する形で、本ファイルに「結論」セクションを追記して締める。実装タスクは別プラン（例: `docs/plans/ai-abuse-mitigation.md`）に切り出す

## 影響範囲

調査タスクなので**コード変更は発生しない**。ただし結果次第で以下に波及する可能性がある:

- `server/src/middleware/rate-limit-ai.ts` — IP バケットや入力長制限の追加
- `server/src/app.ts` — `/api/ai` の CORS を絞る、Origin チェック追加
- `server/src/services/gemini-service.ts` — タイムアウト / リトライ / 入力長ガード
- `server/src/services/settings-service.ts` — `MAX_AI_LIMIT` の引き下げ、IP バケット用設定の追加
- ドキュメント: `feature-tier-matrix.md` の「ゲスト = AI 3 回」前提が崩れる場合は更新

## テスト方針

- 調査結果として「実装を伴う対策」を切り出した時点で、その別プラン側でテスト方針を定義する
- 本プラン内で実機再現を行う場合は、テスト DB / dev サーバ上で行い、本番 `shopping.db` には触れない（CLAUDE.md のテスト規約準拠）
- `tests/integration/ai*.test.ts` 既存ケースをまず読み、現状の挙動が固定されている範囲を確認する

## 想定アウトプット（このファイルに追記する想定の節）

- ## リスク表（A〜D 全件、現状/緩和/未対策/推奨対応の 4 列）
- ## コスト試算（攻撃シナリオ別の月額レンジ）
- ## 推奨対策の優先度付きリスト（即時 / 短期 / 中期）
- ## 結論サマリ（何を緊急で塞ぎ、何は受容するか）

---

# 調査結果

## 追加で確認した事実

静的レビューで上記「現状の把握」に追記すべき事実:

- **デプロイ形態は単一 Node プロセス** (`server/src/index.ts` に cluster/PM2 fork なし)。
  `rateLimitAi` の SELECT → 上限判定 → INSERT は `await` を挟まない同期コード (`better-sqlite3` は同期 API)。
  単一プロセス内では **JS イベントループが中断されないため A-4 のレースは起こらない**。
- **`trust proxy` 未設定** (`app.ts` で `app.set('trust proxy', ...)` の呼び出しなし)。
  本番が Cloudflare 配下なので、IP ベースのレート制限を入れる場合は `trust proxy` と
  `cf-connecting-ip` / `x-forwarded-for` の取り扱いを同時に設計する必要がある。
- **入力長制限が無い** (`server/src/routes/ai.ts:18, 24`)。
  `dishName` は `trim() === ''` だけ、`extraIngredients` は 配列要素ごとに `trim() !== ''` だけ。
  配列長・文字列長の上限が無いので 10KB のプロンプトを送れる。
- **`askGemini` にタイムアウト・リトライ無し** (`server/src/services/gemini-service.ts`)。
  さらに `rateLimitAi` は **成功/失敗に関わらず先にカウント加算する**設計。
  Gemini 5xx 連発時、ユーザーは枠を消費して何も得られない（ただし攻撃者から見ると失敗でもコストを引き出せるという別軸の問題でもある）。
- **CORS は全 Origin 許可** (`app.ts:33`)。`/api/ai` 専用の Origin 絞りなし。
  AI ルートは `app.use('/api/ai', optionalAuth, aiRouter)` (`app.ts:91`) で `optionalAuth` だけ。
- **既存 integration テストが A-1（デバイス ID ローテ）の挙動をそのまま固定している**:
  `server/tests/integration/ai.test.ts:79-88` で「異なる `X-Device-Id` は独立カウント」を保証。
  攻撃も同じ経路を使うので、対策を入れる際はこのテストも更新対象。
- **`MAX_AI_LIMIT = 100000`** (`server/src/services/settings-service.ts:13`)。
  admin 画面から打ち間違いでゲスト枠を 10 万に上げても止まらない。
- **観測**: `pino-http` は `req.headers.authorization` / `cookie` を redact するだけで、
  Origin / Referer / IP の構造化記録は無し（`pino-http` 既定の `req.remoteAddress` は乗るが ai_quota テーブルとは紐付かない）。

## リスク表

凡例: 重大度 / 攻撃容易性 = ★（低）〜★★★（高）。「実質コスト」は preview モデル無料想定なので **金銭ではなく Gemini API 側のレート制限・サービス可用性** に効く形。

| ID | リスク | 攻撃容易性 | 影響 | 既存緩和 | 評価 |
|---|---|---|---|---|---|
| **A-1** | `X-Device-Id` ローテーションで日次枠を無限突破 | ★★★ (任意の文字列で良い) | Gemini コール無制限化。preview 中は金銭ゼロだが API クォータ枯渇＝正規ユーザーへの DoS | DEVICE_ID_SECRET でハッシュ化 (但し攻撃者は元 ID 任意なので意味薄) | **要対策（最優先）** |
| **A-2** | 任意の Web ページから fetch 可能 (CORS ワイルドカード) | ★★★ | 第三者サイトから「無料 Gemini プロキシ」として埋め込み利用される可能性 | 無し | **要対策** |
| **A-3** | 偽 JWT で「ユーザー枠 20 回」昇格 | ★ (無理) | 無し（`optionalAuth` は不正トークンを単に無視） | `verifyJwt` の署名検証 | **受容** |
| **A-4** | 並列リクエストで上限オーバーラン | ★ (無理) | 単一プロセス + better-sqlite3 同期 → イベントループ不可分 | 実装上自然に防げている | **受容** |
| **B-5** | `dishName` プロンプトインジェクション | ★★ | 出力 JSON を破壊できるが `parseDishInfo` が空配列で握り潰す。サーバ側被害無し | パーサが defensive | **受容**（B-6 で巻き取り） |
| **B-6** | 巨大入力でトークン爆発 | ★★ | 入力トークン 10〜100 倍。出力は構造化 JSON で頭打ち | 無し（長さ検証なし） | **要対策（軽量）** |
| **C-7** | preview モデル終了後の自動課金 / 誤って Pro 切替 | ★ | コスト数倍〜数十倍。気付かない | 無し（環境変数のみ） | **要対策（運用）** |
| **C-8** | 失敗にもクォータが消費される / リトライストーム | ★★ | UX 劣化 + Gemini API 側レート制限ヒット | 無し | **要対策（中期）** |
| **C-9** | admin 画面で誤って `MAX_AI_LIMIT=100000` を設定 | ★ (操作ミス) | コスト爆発の理論上限 | `MAX_AI_LIMIT` の単一バリデーションのみ | **要対策（軽量）** |
| **D-10** | 異常検知の基盤無し | — | 起きても気付かない | 429 はログに残るが集計ダッシュボード無し | **要対策（中期）** |

## コスト試算

仮定:
- 1 リクエストあたり **入力 ~250 tokens、出力 ~700 tokens**（日本語プロンプト + 3 レシピ JSON）
- Gemini Flash Lite 公開単価レンジ（2.5 系）: 入力 $0.10/M、出力 $0.40/M
- 為替 ¥150/USD
- 1 件あたりコスト ≒ $0.000305 ≒ **¥0.046/call**

| シナリオ | 想定リクエスト/日 | 月額（lite） | 月額（誤って Pro 切替: 入力$1.25/M, 出力$10/M） |
|---|---|---|---|
| 暇つぶし系（1 攻撃者がローテで叩く） | 1,000 | 約 ¥1,400 | 約 ¥33,000 |
| 持続妨害（1 req/8.6s） | 10,000 | 約 ¥14,000 | 約 ¥330,000 |
| 小規模 botnet（100 端末 × 1,000） | 100,000 | 約 ¥138,000 | 約 ¥3,300,000 |
| 入力膨張型（10KB dishName, 10k req/日） | 10,000 | 約 ¥27,000 | 約 ¥1,000,000 |

注意点:
- 現在は `gemini-3.1-flash-lite-preview` で **preview 中は実質無料**。上記は preview 終了想定の数値。
- preview 中でも **Gemini API 側の無料枠 RPM/RPD 上限** を超えると 429 が返り、**正規ユーザーが AI を使えなくなる** 可用性インシデントになる（ここが今の最大リスク）。
- 出力トークンは構造化 JSON で頭打ちなので、入力長制限さえ入れればコストは線形以下に抑えられる。

## 推奨対策の優先度付きリスト

### 即時（次の小タスクで実装）

1. **入力長制限** (`server/src/routes/ai.ts`)
   - `dishName` を 100 文字まで、`extraIngredients` を 20 件 × 各 50 文字まで
   - 超過は 400 で reject。**B-6 完封 + プロンプトインジェクション影響軽減**
   - テスト: `tests/integration/ai.test.ts` に長文/大量配列の 400 ケース追加
2. **`MAX_AI_LIMIT` の引き下げ** (`server/src/services/settings-service.ts:13`)
   - `100000` → 例えば `500`。admin 操作ミスの保険
3. **`/api/ai` の CORS タイト化** (`server/src/app.ts`)
   - allow-list: `https://basket.chobi.me` と Expo native（Origin 無）。
   - 他は `Access-Control-Allow-Origin` を返さない（preflight 失敗）
   - **A-2 を直接塞ぐ**

### 短期（別プランに切り出す）

4. **IP ベース日次バケット**（A-1 の現実的な対策）
   - `app.set('trust proxy', 'loopback, linklocal, uniquelocal')` + Cloudflare の `cf-connecting-ip` 採用
   - `rateLimitAi` を「IP 100 req/日」と「device 3 req/日」の AND 条件に拡張
   - 単一 IP からの大量デバイス ID ローテを抑止
   - ストレージは `ai_quota` を流用（key 接頭辞 `ip:` を増やすだけ）
5. **`askGemini` にタイムアウト + 失敗時クォータ返却**
   - `AbortController` で 30s タイムアウト
   - `rateLimitAi` を「成功時に加算」モデルへ書き換え（route 内で finalize する設計、もしくは middleware を `pre`/`post` の二段に分ける）
   - 副次効果として C-8 解消
6. **観測強化**
   - `ai_quota` テーブルか別の `ai_request_log` テーブルに「IP（ハッシュ後）/ Origin / status / model / latency」を残す
   - admin 画面か status-report メールに「日次 429 件数 / 上位 IP」を載せる

### 中期（ティア戦略と合流）

7. **CAPTCHA / Cloudflare Turnstile を未ログイン AI に必須化**
   - bot 流入を根本的に減らす。`feature-tier-matrix.md` の「ゲストの試用」体験を悪化させる副作用あり
8. **未ログイン AI の完全廃止**
   - もっとも安全。ただし「触ってログインしたくなる」導線を失うので戦略判断が必要
9. **preview モデル監視 / モデル単価マスタ**
   - 既存 TODO「AI トークン使用量を記録して料金集計」と統合し、preview 終了を検知して slack/メール通知

### 受容（対策しない）

- **A-3 (JWT 偽装)**: 既に無効化されている。
- **A-4 (レース)**: 単一プロセス + 同期 SQLite で構造的に発生しない。クラスタ化する場合は要再評価。
- **B-5 (プロンプトインジェクション)**: パーサが空配列で握り潰し、サーバ側被害なし。コスト面は B-6 と統合で対処。

## 結論サマリ

**緊急で塞ぐべきは「即時」3 点（入力長制限 / CORS allow-list / MAX_AI_LIMIT 引き下げ）**。
これだけで「無料 Gemini プロキシ化」と「admin 操作ミス爆発」を防げ、コードの変更量は小さい。
preview モデル中の現時点では金銭被害より **API 側レート制限による正規ユーザーへの DoS リスク** が
本質的な脅威で、これに対する短期対策の本命は **「短期 4」 IP ベース日次バケット**。

「短期 5」「短期 6」「中期」はティア設計（`feature-tier-matrix.md`）と合流して別プランで議論すべきなので、
本タスクの後続として次のチケットを切る:

- `docs/plans/ai-input-validation-and-cors.md`（即時 1〜3 をまとめて 1 PR）
- `docs/plans/ai-ip-rate-limit.md`（短期 4）
- `docs/plans/ai-observability.md`（短期 6 + 中期 9）

CAPTCHA / 未ログイン AI 廃止は **`feature-tier-matrix.md` の「有料プラン方向性」** が固まってから判断（先に CAPTCHA を入れると新規ユーザー体験を毀損するため、ティア戦略との順序設計が要る）。
