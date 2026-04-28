# Passkeys 認証対応の検証

## 目的・背景

現在の認証フローは以下:

- **Magic Link / OTP**（メール + 6 桁コード） — モバイル・サーバ双方に実装あり、実運用中
- **Google OAuth（サーバ実装）** — `/api/auth/google` で ID Token 検証は実装済みだが、
  **モバイル側に ID Token を取得する native 実装が無い**（`mobile/package.json` に
  `@react-native-google-signin/google-signin` 等が未追加）。実質、現行ユーザーが
  使えているフローは Magic Link / OTP のみ

これは安全だが、JWT 有効期限が **30 日固定**（`server/src/services/auth-service.ts:8`、
`JWT_EXPIRES_IN = '30d'`）であり、切れた後・新端末ログイン時に毎回メール往復が発生する。
お料理バスケットは個人がスーパーで素早く立ち上げる用途なので、ログイン体験の改善余地はある。

ただし、改善手段は **passkey 一択ではない**。本プランは「passkey を入れるか」を決めるための
検証であって、まず他の選択肢と比較した上で着手判断を下す。

### 改善手段の比較（Phase 0 で更新する叩き台）

| 案 | 想定工数 | UX 改善度 | 既存影響 | 主リスク |
|---|---|---|---|---|
| (a) **JWT を 90 日 + Refresh Token** | 0.5〜1 人日 | 中（往復頻度 1/3） | サーバのみ | Refresh Token 漏洩時の被害拡大 |
| (b) **Apple Sign In 追加（iOS のみ）** | 2〜3 人日 | 大（iOS） | モバイル + サーバ少 | iOS 限定、Apple ID 紐付け管理 |
| (c) **Google OAuth モバイル native 化**（サーバは既存活用） | 2〜4 人日 | 大（Android 中心） | モバイル中心 | Expo + Google Sign-In ライブラリの相性 |
| (d) **Passkey 併設（本プラン本体）** | 検証だけで 5〜8 人日、本実装で更に 5〜10 人日 | 大（両 OS） | サーバ・モバイル両方 | ライブラリのメンテ状況、AASA/assetlinks 配信 |

(a) は ROI が圧倒的に良いので、**passkey 検証と無関係に先に取り込んでよい**。
(b)(c) は passkey の代替・補完候補で、本検証 Phase 0 でも比較を更新する。

### 改めて、なぜ passkey を「検証だけでも」進める価値があるか

- メール往復不要のサインイン（Face ID / Touch ID / 指紋）
- パスワード保管・入力なし、コピペ流出なし
- iCloud Keychain / Google Password Manager 経由で複数端末に同期
- 一度設定すれば iOS / Android 両方で UX が均質化（(b)(c) は片 OS ずつ）

ただし以下は未確定で、**実装に着手する前に検証が必要**:

1. Expo SDK 54 + EAS Build で `react-native-passkey`（または相当ライブラリ）が実機で動くか
2. `basket.chobi.me` で AASA / assetlinks を Cloudflare 経由で正しくホスティングできるか
3. サーバ側に `@simplewebauthn/server` を組み込んでも既存 `requireAuth` / JWT フローと共存できるか
4. 既存 OTP / Google OAuth との「主・副」関係をどう設計するか
   （passkey が使えない端末・ブラウザでのフォールバック）
5. 個人開発の運用負荷（AASA の Team ID 変更追従、ライブラリのメジャーバージョン追従）に耐えられるか

このプランは **検証フェーズの計画** であり、本実装プランではない。
各 Phase の最後に判断ポイントを置き、最終 Phase で **Go / No-Go と本実装プランの
スコープ** を確定させる。

## スコープ

- **対象**: モバイルアプリ（iOS / Android、`me.chobi.basket`）のサインイン強化
- **対象外**:
  - ユーザー向け Web の WebAuthn 化（PWA は廃止済み、`web/about.html` と `web/privacy.html` だけ残っている）
  - 管理画面（`/admin/*`）の WebAuthn 化（Cloudflare Access で前段ゲート済みなので優先度が低い）
  - 既存 Magic Link / Google OAuth（サーバ側）の **撤廃**（フォールバックとして残す前提）

## 検証項目（What we need to know before committing to implementation）

### A. クライアント（Expo / React Native）
- A-1. Expo SDK 54 + React Native 0.81 + EAS Build 上で動く Passkey ライブラリは何か
  - 候補: [`react-native-passkey`](https://github.com/f-23/react-native-passkey) /
    `expo-passkey` / その他
  - **Expo Go では動かない**（ネイティブモジュールのため development build が必須）
  - **メンテ状況の確認**（直近 6 か月のコミット数、open issue / PR の滞留、bus factor）。
    個人メンテのライブラリだと Expo SDK 55/56 のアップグレードに追従できないリスクがある
- A-2. 必要な iOS / Android バージョン下限
  - 目安: iOS 16+ / Android 9+ + Google Play Services 23.40+
  - **手元実機の OS バージョンを Phase 0 で確定**（不足なら端末 OS 更新が前提作業に入る）
- A-3. Bundle ID `me.chobi.basket` での Associated Domains 設定方法
  - 現状 `mobile/app.json` には `associatedDomains` / Android `intentFilters` の設定 **なし**
  - `app.json` の iOS `associatedDomains` および Android `intentFilters` を追加する形になる
- A-4. UX：登録時（passkey 作成）と認証時（passkey 使用）のネイティブダイアログの見た目

### B. ドメイン関連付け
- B-1. `https://basket.chobi.me/.well-known/apple-app-site-association`
  （JSON、`Content-Type: application/json`、リダイレクトなし、TLS 必須）の配信
- B-2. `https://basket.chobi.me/.well-known/assetlinks.json`（Android）の配信
- B-3. **配信ルートが未確定**: 現状 `web/.well-known/` は存在せず、Cloudflare の配信が
  Cloudflare Pages か Workers か、Express からの reverse proxy かが README / wrangler 設定に
  明示されていない。Phase 0 で配信パスを確定する
- B-4. Cloudflare 経由でこれらのファイルがリダイレクト・キャッシュ・改変なしで届くか
  （Cloudflare は AASA をいじることがあるので要確認。Browser Integrity Check / Bot Fight Mode の影響も）
- B-5. AASA は Apple 側で **数時間〜数日キャッシュされる** ため、Phase 2 と Phase 3 の
  間に最低 1 営業日のバッファを確保する
- B-6. SHA-256 署名フィンガープリントの取得（EAS の `eas credentials` で参照可能）
- B-7. **AASA を公開すると Apple Team ID が露出する**（情報レベル、フィッシングアプリ作成の
  ヒントにはなり得るが、現実的な被害想定は小さいので許容）

### C. サーバ
- C-1. `@simplewebauthn/server` を Express に組み込んだときの API デザイン
  - `POST /api/auth/passkey/register/options` → `generateRegistrationOptions`
  - `POST /api/auth/passkey/register/verify` → `verifyRegistrationResponse`
  - `POST /api/auth/passkey/auth/options` → `generateAuthenticationOptions`
  - `POST /api/auth/passkey/auth/verify` → `verifyAuthenticationResponse`（成功で JWT 返却）
- C-2. RP ID（`basket.chobi.me`）と origin 検証の設定
  - **RP ID 制約**: `basket.chobi.me` で発行した passkey は `chobi.me` 直下や他サブドメインでは
    使えない。将来 `app.chobi.me` 等に分割する可能性があるなら、RP ID を `chobi.me` に
    上げる選択肢も検討（その場合 `chobi.me` 直下で AASA を配信する必要がある）
- C-3. challenge の保管先（短命なので redis 不要、SQLite に TTL 付きで持つか
  in-memory `Map` で済ますか — 既存の `magic_link_tokens` のパターン踏襲が無難）
- C-4. credential 保管テーブルの設計（後述 D 参照）
- C-5. Vitest での単体テストの書き方
  - 「`@simplewebauthn/server` 全体をモジュール境界モック」では replay 防止・challenge 期限・
    origin 検証の回帰が検知できない
  - **方針**: 鍵検証部分（`verifyRegistrationResponse` / `verifyAuthenticationResponse`）は
    `@simplewebauthn/server` の公開 fixture を使う形で integration test を 1 セット書き、
    DB 書き込み・期限切れ・sign_count 更新は unit test でカバー

### D. データモデル
新規テーブル `passkey_credentials`（暫定案）:

```
id              INTEGER PRIMARY KEY AUTOINCREMENT
user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
credential_id   TEXT NOT NULL UNIQUE      -- base64url
public_key      BLOB NOT NULL              -- COSE 形式
sign_count      INTEGER NOT NULL DEFAULT 0
transports      TEXT                       -- JSON array (e.g. ["internal","hybrid"])
device_label    TEXT                       -- ユーザーに見せる「iPhone 15」等の名前
backed_up       INTEGER NOT NULL DEFAULT 0 -- BE/BS フラグ（クラウド同期 passkey の判定）
created_at      TEXT DEFAULT (datetime('now'))
last_used_at    TEXT
```

短命な challenge 保管:

```
passkey_challenges
  user_id (nullable: 認証時はメール先行入力前なら null), challenge, expires_at, kind ('register'|'auth')
```

`users` テーブル本体は **変更しない** 方向で検討（メール = アカウント識別子の現状を維持）。

#### 設計上の落とし穴（プラン本体で結論を出す）

- **`sign_count = 0` の扱い**: iCloud Keychain / Google Password Manager 同期の passkey は
  `sign_count` を常に 0 で返す。`@simplewebauthn/server` の推奨どおり、**サーバ側保存値が 0 かつ
  受信値も 0 の場合は不一致チェックをスキップ** する。それ以外は厳格に検証
- **`userHandle` 戦略**: `users.id` をそのまま userHandle に使うか、不変 ID を別途持つか。
  メール変更時にも passkey を維持したい・将来 discoverable credential（メール先入力なしの
  サインイン）を有効にしたいなら、userHandle は **不変な内部 ID** にする
- **孤児 credential**: ユーザーが端末側でだけ passkey を消すと、サーバ側に未使用 credential が
  残る。設定画面の「登録済みデバイス」UI から手動削除させる方針で OK だが、
  `last_used_at` が一定期間（例: 6 か月）更新されない credential を一覧時に
  「未使用」表示する程度のヒントは持たせる
- **アカウント削除**: `ON DELETE CASCADE` で credential も削除される（既存パターン踏襲）

### E. 既存認証との共存

#### サインインフロー（プラン本体で確定する案）

```
モバイル起動
  └─ JWT があり有効 → そのままログイン
  └─ JWT が無い／切れ
       └─ ユーザーがメール入力
            └─ サーバが「このメールに登録済 passkey があるか」を返す
                 ├─ ある → passkey 認証ダイアログ
                 │    ├─ 成功 → JWT 発行
                 │    └─ キャンセル / 失敗 → OTP メール送信に自動フォールバック
                 └─ ない → OTP メール送信（既存フロー）
```

discoverable credential（メール先入力不要）は **Phase 5 で採否を決める**。
iOS / Android の Conditional UI 対応状況がライブラリで安定しているかが分岐点。

#### 新規ユーザーフロー（**E-2: 重要分岐**）

- **案 X: メール所有確認を必須にする** — 初回は OTP で 1 回認証 → その後 passkey 登録を促す
  - 利点: 他人のメールでアカウントを作るなりすましを防げる
  - 欠点: 初回の往復は残る
- **案 Y: passkey-only でアカウント作成可能にする** — メール所有確認なし
  - 利点: 初回からメール往復ゼロ
  - 欠点: メールアドレスの真正性が無い（パスワードリセット相当の動線が破綻）

→ **案 X（OTP 必須）を採用**する方針で本実装プランを書く。料理バスケットは
   メールアドレスをユーザー識別子として全機能で使っているため、所有確認を捨てる利益が薄い。

#### その他

- E-1. 既存ユーザー（OTP でログイン済み）は **既存セッション中に passkey を「追加登録」できる動線**
  を設定画面に持つ
- E-3. Passkey 非対応端末（古い OS / Expo Go 開発時 / passkey 未登録ユーザー）は **自動で OTP に
  フォールバック**（上記フロー図参照）
- E-4. Passkey 削除 / 一覧表示 UI（設定画面に「登録済みデバイス」セクション、`device_label` と
  `last_used_at` を表示）
- E-5. **JWT 有効期限の見直し** — 比較表 (a) で挙げた「90 日 + Refresh Token」化は本検証プランの
  対象外（独立タスクとして TODO に積む）。passkey が入って「いつでも再認証できる」になっても、
  JWT 寿命の短縮は別軸で議論する

## 検証 Phase

> **並列実行可能**: Phase 1（調査）と Phase 2（AASA 配信）は依存が無いので並走できる。
> Phase 2 は Apple 側の AASA キャッシュ待ち（最大数日）があるため、**先に着手して並走**するのが効率的。

### Phase 0: 事前確認（半日、コード変更なし）

事実関係の確定。Phase 1 以降の手戻りを防ぐ。

- **Step 0-1**: Apple Developer Program の Team ID を `eas credentials` または Apple Developer
  Portal から取得・記録
- **Step 0-2**: 手元実機の OS バージョンを確認（iPhone iOS、Android）。要件不足なら OS 更新が
  Phase 3 の前提作業になる
- **Step 0-3**: `basket.chobi.me` の `.well-known/` 配信ルートを確定
  - 候補: (i) Express から `/.well-known/*` を静的配信、(ii) Cloudflare Pages の追加配信、
    (iii) 既存 web 配信に静的ファイル追加
  - 現状 `web/.well-known/` は未存在、`wrangler.toml` も未発見なので、配信構成を README
    または運用メモから特定
- **Step 0-4**: モバイル Google OAuth の現状を再確認
  - サーバの `/api/auth/google` を叩いている Expo 側の実装が本当に無いか、または
  　別フローで使われているかを `mobile/src/api/` と `mobile/src/stores/auth-store.ts` で確認
  - 「無い」が確定したら、本検証プランの背景の「Google OAuth はフォールバック」記述から外す
- **Step 0-5**: 比較表 (a)(b)(c) のうち、**(a) JWT 90 日 + Refresh Token を先に着手するか**を判断
  - 着手するなら独立 TODO として切り出し、本検証プランとは無関係に進める

**判断ポイント**: 上記 Step が全部埋まる。配信ルート未確定 / 端末 OS 不足 / Team ID 取得不可
のいずれかで詰むなら **No-Go**（または当該事項を解消するまで保留）。

### Phase 1: 技術調査（コード変更なし）

- **Step 1-1**: ライブラリ選定
  - `react-native-passkey` の最新バージョンと Expo SDK 54 / RN 0.81 互換性を確認
  - 直近 6 か月のコミット数、open issue / PR の滞留、メンテナ数（bus factor）を記録
  - GitHub Issues で Expo prebuild / EAS Build 起因の既知問題を洗い出す
  - 代替候補（`expo-passkey` など）が出ていれば比較メモ
- **Step 1-2**: サーバ側ライブラリ確認
  - `@simplewebauthn/server` の現行バージョン、ライセンス、メンテ状況
  - Vitest との相性（過去 issue 等）、公開 fixture の有無
- **Step 1-3**: AASA / assetlinks の Cloudflare 配信ベストプラクティス調査
  - Cloudflare の「Always Use HTTPS」「Auto Minify」「Rocket Loader」「Browser Integrity
    Check」「Bot Fight Mode」が JSON を壊さないか
  - Page Rules / Configuration Rules で `.well-known/` を除外する必要があるか

**判断ポイント**: ライブラリ選定が確定し、要件・既知問題が許容できるか。
具体基準:
- ライブラリの直近 6 か月コミット数 ≥ 5、open issue 滞留 < 50、Expo SDK 54 動作報告あり
- `@simplewebauthn/server` が active メンテ（直近 3 か月コミットあり）

NG なら **No-Go**（プラン全体を中止し TODO.md に「○ 年待ち」コメントだけ残して終了）。

### Phase 2: ドメイン関連付けファイルの試験配信

> Phase 1 と並行可能。Apple AASA キャッシュの待ち時間があるので**先行着手推奨**。

- **Step 2-1**: 試作 AASA を `basket.chobi.me/.well-known/apple-app-site-association` で配信
  - 中身は webcredentials の Team ID + Bundle ID
  - 配信ルートは Phase 0 Step 0-3 で確定したものを使う
  - `Content-Type: application/json` で返ること、**リダイレクトしないこと**を `curl -I` で確認
- **Step 2-2**: 試作 `assetlinks.json` を同様に配信、SHA-256 フィンガープリントは
  EAS Internal distribution build から拾う
- **Step 2-3**: Apple の AASA validator / Google の Statement List Generator and Tester で検証
- **Step 2-4**: Cloudflare のキャッシュ設定で `.well-known/*` が改変されないことを確認
- **Step 2-5**: AASA キャッシュ TTL を考慮し、**Step 2-3 通過後 Phase 3 着手まで最低 1 営業日**
  待つ

**判断ポイント**: AASA / assetlinks が validator を通る。
具体基準:
- Apple validator: fatal error 0 件（warning は許容）
- Google validator: 全項目 pass
- `curl -IL https://basket.chobi.me/.well-known/apple-app-site-association` で
  `200 OK` + `Content-Type: application/json` + リダイレクト 0 段

通らないなら、原因が Cloudflare 設定変更で済むのか、ホスティング構成見直しが必要かを判定。

### Phase 3: モバイル PoC（development build）

- **Step 3-1**: Feature ブランチで `react-native-passkey` を導入し、`app.json` の
  iOS `associatedDomains` / Android `intentFilters` を設定
- **Step 3-2**: Expo development build を作成（`eas build --profile development`、iOS / Android 双方）
- **Step 3-3**: PoC 画面を独立した `mobile/app/passkey-poc.tsx`（temp スクリーン）として作成
  - 「passkey 登録」ボタン → 後述のサーバ PoC エンドポイントを叩く
  - 「passkey でサインイン」ボタン → 同
- **Step 3-4**: 実機（Akira 所有 iPhone / Android）で動作確認
  - 登録ダイアログが出るか、認証ダイアログが出るか、UX に違和感がないか

**判断ポイント**: 実機で **登録 → 認証 → JWT 取得 → `/api/auth/me` 成功** が **iOS / Android 両方**で
通る。
具体基準:
- iOS: 登録 1 回 + 認証 3 回連続成功（キャンセル経路含む）
- Android: 登録 1 回 + 認証 3 回連続成功
- ネイティブダイアログの日本語表記を確認、明らかな英語混じりや UI 崩れがない

通らないなら、原因（associated domains 未認識 / RP ID 不一致 / OS バージョン制約 等）を
切り分けて解決可能かを判定。

### Phase 4: サーバ PoC（@simplewebauthn/server 組み込み）

- **Step 4-1**: `server/src/services/passkey-service.ts` を新設し、4 つの API ハンドラを
  feature flag 付き（`ENABLE_PASSKEYS=1` の時だけルート登録）で実装
- **Step 4-2**: `passkey_credentials` / `passkey_challenges` テーブルのマイグレーションを
  `database.ts` に **v12** として追加
  - 現状 `database.ts` は v11 まで定義済み（baseline 含む）
  - **重要**: SQLite では v12 を入れた後の現実的なロールバックは難しい。No-Go の場合は
    v13 で `DROP TABLE` する形になる。これを許容するか、PoC 期間中は**ローカル DB に
    対してだけ migration を流し**、本番には流さない運用にするかを Phase 4 着手時に確定
- **Step 4-3**: 既存 `requireAuth` ミドルウェアはそのまま（passkey で取得した JWT も同じ形式）
- **Step 4-4**: Vitest unit test
  - DB 書き込み、challenge 期限切れ、sign_count 更新（`sign_count = 0` のスキップ含む）、
    孤児 credential 検出ヘルパを単体でカバー
- **Step 4-5**: Vitest integration test
  - `@simplewebauthn/server` の公開 fixture（または PoC 中に手元実機で生成した fixture）を
    使い、「options 取得 → 検証 → JWT 発行」の往復を **実鍵で** 1 セット通す
  - これによって challenge / origin / RP ID の検証回帰を捕まえる
- **Step 4-6**: `@simplewebauthn/server` のメジャーバージョンアップに耐える書き方を意識
  （直接の API 依存箇所を `passkey-service.ts` に閉じ込める）

**判断ポイント**: PoC が Phase 3 のクライアントと噛み合い、登録・認証の往復がテストでもグリーン。
具体基準:
- unit test 全パス、integration test の往復 1 セットがパス
- Phase 3 の実機 PoC と同じエンドポイントで疎通

### Phase 5: 共存設計と Go / No-Go 判定

- **Step 5-1**: 既存 OTP / Google OAuth と passkey の関係を本検証プラン E セクションの
  フロー図ベースで確定
  - **新規ユーザー: 案 X（OTP 必須）採用**を再確認
  - discoverable credential を本実装に含めるか除外するかを Phase 3 の実機挙動から判断
- **Step 5-2**: 設定画面の「登録済みデバイス」UI スケッチ（箇条書きでよい）
  - `device_label`, `last_used_at`, 削除ボタン
  - 6 か月未使用の credential に「未使用」バッジ
- **Step 5-3**: 本実装プラン `docs/plans/passkeys-auth-impl.md`（仮）の **目次のみ** 作成
  - PoC コードの扱いを確定:
    - **案 P**: feature flag (`ENABLE_PASSKEYS`) を残したまま main にマージし、本実装は段階的に
    - **案 Q**: PoC コードは捨てて main は元に戻し、本実装プランで一括書き直し
  - 個人開発の運用負荷を考えると **案 P を推奨**（feature ブランチ放置のリスクを避ける）
- **Step 5-4**: TODO.md / DONE.md 更新、本検証プランをアーカイブへ

**判断ポイント**: 本実装プランを起こすに十分な解像度になっているか。
判定の三択を明文化:

- **Go**: Phase 1〜4 すべて判断ポイント通過、ライブラリ選定確定、AASA 通過、実機両 OS で
  認証往復成功、テスト戦略が現状の規約に収まる → 本実装プラン作成へ
- **Go-with-conditions**: 一部 Phase で条件付き通過（例: Android だけ別ライブラリが必要、
  discoverable credential は当面見送り、特定 OS バージョンを足切り）→ 条件を本実装プランの
  スコープに明記して進む
- **No-Go**: ライブラリのメンテ状況・AASA 配信不可・実機で安定動作しない等のブロッカーが残る →
  TODO.md に「○ 年待ち」コメントだけ残し、本検証プランは Go-No-Go 結論をアーカイブ

## 影響範囲（検証フェーズで触るもの）

### コード（PoC のみ・main 戦略は Phase 5 Step 5-3 で確定）

- 新規: `mobile/app/passkey-poc.tsx`（temp スクリーン）
- 新規: `server/src/services/passkey-service.ts`, `server/src/routes/passkey.ts`
- 変更: `server/src/database.ts`（**v12** マイグレーション、feature flag で無効化可能）
- 変更: `mobile/app.json`（associatedDomains, intentFilters）
- 変更: `mobile/package.json`, `server/package.json`（依存追加）

### コード（main に直接入れて構わないもの）

- `apple-app-site-association` / `assetlinks.json` 配信（Phase 2 で配信開始してよい — passkey
  未利用でも害はない）
  - 配信パスは Phase 0 Step 0-3 で確定したルートに従う

### 触らないもの

- 既存 `auth-service.ts` / `auth.ts` / `requireAuth` ミドルウェア
- 既存 `mobile/src/stores/auth-store.ts` / `AuthModal.tsx`
- 管理画面（`/admin/*`）の認証

## テスト方針（PoC フェーズ）

- サーバ:
  - `passkey-service.test.ts`（unit）— DB / challenge / sign_count を Vitest でカバー
  - `passkey.integration.test.ts`（integration）— `@simplewebauthn/server` の公開 fixture または
    実機生成 fixture で**実鍵 1 セット**を通す（モジュール境界モックだけにしない）
  - PoC 期間中は CI で必須化せず、ローカル実行のみでもよい
- モバイル: PoC スクリーンに RN 描画テストは追加しない（既存規約どおり）
- 実機確認: iPhone（Akira 所有）と Android 端末で Phase 3 のチェックリストを通す

## やらないこと（このプランの対象外）

- パスワードレス完全移行（メール OTP はフォールバックとして残す）
- ユーザー向け Web の WebAuthn 対応（PWA は廃止済み）
- 管理画面の passkey 化（Cloudflare Access で十分ゲートできている）
- Apple Watch / その他デバイス間ハンドオフの最適化
- **JWT 有効期限の見直し**（比較表 (a) として独立 TODO に切り出す。本検証プランの判定材料には
  しない）
- モバイル Google OAuth ネイティブ化（比較表 (c) として独立 TODO 候補。本検証プランで
  決めるのは「passkey をやるか」だけ）

## 完了条件（このプランが「終わった」と言える基準）

1. Phase 0〜5 のすべての判断ポイントが埋まっている
2. 本実装プラン `docs/plans/passkeys-auth-impl.md` の目次（または「No-Go の理由」メモ）が存在する
3. TODO.md からこの項目を削除し、DONE.md へ移動、検証プラン本ファイルを `docs/plans/archive/`
   へ移動

## 参考リンク

- [WebAuthn Level 3 仕様](https://www.w3.org/TR/webauthn-3/)
- [@simplewebauthn/server](https://simplewebauthn.dev/docs/packages/server)
- [react-native-passkey](https://github.com/f-23/react-native-passkey)
- [Apple: Supporting passkeys](https://developer.apple.com/documentation/authenticationservices/public-private-key-authentication)
- [Android: Sign in your user with Credential Manager](https://developer.android.com/training/sign-in/passkeys)
- 既存設計: `server/src/services/auth-service.ts`, `server/src/middleware/auth.ts`,
  `mobile/src/stores/auth-store.ts`
