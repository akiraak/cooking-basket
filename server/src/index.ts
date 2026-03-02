import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/error-handler';
import { shoppingRouter } from './routes/shopping';
import { adminRouter } from './routes/admin';
import { claudeRouter } from './routes/claude';
import { recipesRouter } from './routes/recipes';
import { dishesRouter } from './routes/dishes';
import { docsRouter } from './routes/docs';
import { initDatabase } from './database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_VERSION = Date.now().toString();

// ミドルウェア
app.use(cors());
app.use(express.json());

// index.html にキャッシュバージョンを埋め込んで返す
const webDir = path.join(__dirname, '../../web');
const indexHtml = fs.readFileSync(path.join(webDir, 'index.html'), 'utf-8')
  .replace(/__CACHE_VERSION__/g, CACHE_VERSION);

app.get('/', (_req, res) => {
  res.type('html').send(indexHtml);
});

// 静的ファイル配信 (Web クライアント)
app.use(express.static(webDir));

// ヘルスチェック
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' }, error: null });
});

// API ルート
app.use('/api/shopping', shoppingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/claude', claudeRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/dishes', dishesRouter);
app.use('/docs', docsRouter);

// エラーハンドリング
app.use(errorHandler);

// DB 初期化 & サーバ起動
initDatabase();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
