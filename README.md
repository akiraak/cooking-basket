# Life Stream Claude

スマホ向けの買い物リスト Web アプリ。料理を登録すると AI が具材とレシピを提案してくれます。

## 主な機能

- **買い物リスト** — アイテムの追加・チェック・削除
- **料理管理** — 料理を追加してアイテムをグループ化
- **AI 具材提案** — 料理名から Gemini AI が必要な具材を自動提案、選択してリストに一括追加
- **AI レシピ表示** — 料理ごとにおすすめレシピ3件を表示（手順の折りたたみ付き）
- **サジェスト** — 過去の購入頻度をもとにアイテム名・料理名を補完
- **AI データ引き継ぎ** — 同じ料理名なら前回の AI データを再利用、AI 再取得も可能
- **管理画面** — データ一覧・編集・サーバ統計

## アーキテクチャ

```
┌─────────────┐       HTTPS/REST        ┌──────────────────┐
│  Web Client │  <──────────────────>    │  Server (Node.js) │
│  (HTML/JS)  │       JSON              │  Express + SQLite  │
│  モバイル最適化│                        │                    │
└─────────────┘                         ├──────────────────┤
                                        │  Gemini API       │ ← AI 具材・レシピ提案
                                        │  Claude Code CLI  │ ← レシピ推薦
                                        └──────────────────┘
```

## 技術スタック

| レイヤ | 技術 |
|--------|------|
| サーバ | Node.js 20+, Express.js, TypeScript |
| DB | SQLite (better-sqlite3, WAL モード) |
| AI | Google Gemini API (具材・レシピ), Claude Code CLI (レシピ推薦) |
| Web | HTML / CSS / JavaScript (フレームワークなし, モバイルファースト) |

## ディレクトリ構成

```
life-stream-claude/
├── server/                 # サーバサイド (Node.js / Express / TypeScript)
│   ├── src/
│   │   ├── index.ts        # エントリポイント
│   │   ├── database.ts     # SQLite 初期化・マイグレーション
│   │   ├── routes/
│   │   │   ├── shopping.ts # 買い物リスト API
│   │   │   ├── dishes.ts   # 料理 API + AI 具材提案
│   │   │   ├── recipes.ts  # レシピ推薦 API
│   │   │   ├── claude.ts   # Claude Code 汎用 API
│   │   │   └── admin.ts    # 管理用 API
│   │   ├── services/
│   │   │   ├── shopping-service.ts  # 買い物リスト CRUD
│   │   │   ├── dish-service.ts      # 料理 CRUD + AI データ管理
│   │   │   ├── gemini-service.ts    # Gemini API 呼び出し
│   │   │   └── claude-service.ts    # Claude CLI 呼び出し
│   │   └── middleware/
│   │       └── error-handler.ts
│   ├── package.json
│   └── tsconfig.json
├── web/                    # Web クライアント (静的ファイル)
│   ├── index.html          # 買い物リスト画面
│   ├── app.js
│   ├── style.css
│   └── admin/              # 管理画面
├── CLAUDE.md               # Claude Code 開発ガイド
├── TODO.md / DONE.md       # タスク管理
└── LICENSE                 # MIT
```

## セットアップ

### 前提条件

- Node.js 20+
- npm
- Google Gemini API キー

### インストール

```bash
cd server
npm install
```

### 環境変数

```bash
cp server/.env.example server/.env
```

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `PORT` | `3000` | サーバのリッスンポート |
| `GEMINI_API_KEY` | — | Google Gemini API キー |

### 起動

```bash
# 開発 (ホットリロード)
cd server
npm run dev

# プロダクション
cd server
npm run build
npm start
```

サーバ起動後:
- 買い物リスト: http://localhost:3000/
- 管理画面: http://localhost:3000/admin/

## API エンドポイント

### 買い物リスト

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/shopping` | 一覧取得 |
| POST | `/api/shopping` | アイテム追加 `{ name, category? }` |
| PUT | `/api/shopping/:id` | アイテム更新 |
| DELETE | `/api/shopping/:id` | アイテム削除 |

### 料理

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/dishes` | 全料理取得 |
| GET | `/api/dishes/suggestions?q=` | 料理名サジェスト |
| POST | `/api/dishes` | 料理追加 (同名料理から AI データ引き継ぎ) |
| DELETE | `/api/dishes/:id` | 料理削除 |
| POST | `/api/dishes/:id/suggest-ingredients` | AI 具材・レシピ提案 (`{ force? }`) |
| POST | `/api/dishes/:id/items` | 料理にアイテムをリンク |
| DELETE | `/api/dishes/:id/items/:itemId` | リンク解除 |

### レスポンス形式

すべての API は共通の形式で返します:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照。
