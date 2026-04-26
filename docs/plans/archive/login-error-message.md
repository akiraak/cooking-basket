# ログインコードエラー表示の改善

TODO: 「ログインコードが違う場合は401エラーではなく、ログインコードが違います等の表示をおこなう」

## 目的・背景

Magic Link 認証のコード入力画面で、誤ったコードや期限切れコードを入力すると
ユーザーには「Request failed with status code 401」のような英語のメッセージが
`Alert.alert('エラー', ...)` で表示されてしまう。

サーバ側は既に日本語の親切なメッセージを返している。

```ts
// server/src/routes/auth.ts:46
res.status(401).json({ success: false, data: null, error: 'コードが無効または期限切れです' });
```

しかしモバイル側の API クライアント (`mobile/src/api/auth.ts`) は axios の
デフォルト挙動（4xx/5xx で reject）に対応しておらず、`res.data.error` に
到達する前に AxiosError が throw されている。

```ts
// mobile/src/api/auth.ts:15-19  ← 4xx 時はここに到達しない
export async function verifyCode(email, code) {
  const res = await client.post<ApiResponse<...>>('/api/auth/verify-code', ...);
  if (!res.data.success) throw new Error(res.data.error ?? '認証に失敗しました');
  return res.data.data;
}
```

そのため AuthModal の catch では AxiosError がそのまま流れてきて、
`Alert.alert('エラー', e.message)` が `"Request failed with status code 401"` を表示する。

```ts
// mobile/src/components/auth/AuthModal.tsx:64-69
} catch (e: unknown) {
  const message = e instanceof Error ? e.message : '認証に失敗しました';
  Alert.alert('エラー', message);
  ...
}
```

## 対応方針

### 方針 A（推奨）: axios クライアントでサーバの `error` フィールドを抽出する

`mobile/src/api/client.ts` のレスポンスインターセプタで、エラー時に
`error.response?.data?.error` が文字列ならそれを `error.message` に差し替える。

メリット
- `verifyCode` 以外の API も同じ恩恵を受ける（将来同様の問題が起きない）
- 各 API 関数 (`auth.ts`, `recipe.ts`, etc.) を変更しなくていい
- `AxiosError` の他のプロパティ（status など）はそのまま残るので、必要なら呼び出し側で参照できる

実装例
```ts
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await removeToken();
    }
    const serverMessage = error.response?.data?.error;
    if (typeof serverMessage === 'string' && serverMessage.length > 0) {
      error.message = serverMessage;
    }
    return Promise.reject(error);
  },
);
```

### 方針 B: 個別 API 関数の try/catch でハンドリング

`verifyCode` だけを直す。他の API は据え置き。

```ts
export async function verifyCode(email: string, code: string) {
  try {
    const res = await client.post<ApiResponse<...>>('/api/auth/verify-code', { email, code });
    if (!res.data.success) throw new Error(res.data.error ?? '認証に失敗しました');
    return res.data.data;
  } catch (e: any) {
    const msg = e?.response?.data?.error;
    if (typeof msg === 'string' && msg.length > 0) throw new Error(msg);
    throw e;
  }
}
```

メリット
- 影響範囲が verifyCode に閉じる
- 401 を別箇所で利用したい場合に副作用が少ない

デメリット
- 同じパターンの他の API (`requestLogin`, `getMe`, ...) は未対応のまま
- 同種の問題が他画面で再発しうる

→ **方針 A を採用する**。シンプルで再発防止にもなる。

### サーバ側のメッセージ分割について（やらない）

TODO の文面「ログインコードが違います」を文字通り取ると、「コードが違う」
「期限切れ」「未送信」を区別したくなるが、現状サーバは意図的に統一メッセージ
（`コードが無効または期限切れです`）を返している。これは

- 攻撃者にメール存在の有無や入力コードの有効期間を絞り込ませない
- 期限切れ ↔ 入力ミスの誤判定（時計ずれ等）を吸収できる

という観点で妥当なので、本タスクではメッセージの分割はしない。
ユーザに何かしら親切な日本語が出ればよい。

ただし「メールアドレスとコードが必要です」（400）はクライアント側のバリデーション漏れ
であり、現状でも UI 側で空入力をブロックしているので問題なし。

## 影響範囲

- `mobile/src/api/client.ts` — レスポンスインターセプタにメッセージ抽出処理を追加
- `mobile/__tests__/api/client.test.ts` — 401 時の token 削除に加え、`error.message` がサーバの `error` 文字列で差し替わることをテスト
- AuthModal は変更不要（既に `e.message` を表示している）。挙動だけ自動で改善される

サーバ・サーバテストには手を入れない。

## テスト方針

### 追加するテスト（mobile）
`mobile/__tests__/api/client.test.ts` に以下を追加。

1. 401 で `data.error` が文字列のとき、catch 側で受け取る error の `message` がそれと一致する
2. 4xx 系で `data.error` が無いとき、`error.message` は元の axios メッセージのまま
3. 既存の「401 で token が削除される」テストは引き続き通る

### 既存テストの確認
- `mobile/__tests__/stores/auth-store.test.ts` — 正常系のみで影響なし
- `server/tests/integration/auth.test.ts` — サーバ側変更なしで影響なし

### 手動確認
1. Expo Go で AuthModal を開き、適当なメールに OTP 送信
2. わざと違うコードを入れて Verify
3. Alert タイトル「エラー」、本文が「コードが無効または期限切れです」になることを確認
4. （可能なら）有効期限切れコードでも同じメッセージが出ることを確認

## Phase / Step 分割

単一 Phase で完結する小さなタスクなので分割しない。

- [ ] `mobile/src/api/client.ts` のレスポンスインターセプタを更新
- [ ] `mobile/__tests__/api/client.test.ts` にテストを追加
- [ ] `cd mobile && npm test` がグリーン
- [ ] 手動で AuthModal の表示を確認
