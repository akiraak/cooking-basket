// lib/logger など env を import 時に読むモジュールより前に .env を流し込む必要があるので、
// 副作用 import として一番上に置く。
import 'dotenv/config';
import { createApp } from './app';
import { initDatabase } from './database';
import { cleanupExpiredTokens } from './services/auth-service';
import { logger } from './lib/logger';

const PORT = process.env.PORT || 3000;

// 起動順序: DB 初期化（マイグレーション適用） → アプリ組み立て → 定期処理 → listen
initDatabase();
const app = createApp();

// 期限切れトークンの定期クリーンアップ（1時間ごと）
setInterval(() => {
  try {
    cleanupExpiredTokens();
  } catch (err) {
    logger.error({ err }, 'cleanup_failed');
  }
}, 60 * 60 * 1000);

app.listen(PORT, () => {
  logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
});
