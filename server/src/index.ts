import dotenv from 'dotenv';
import { createApp } from './app';
import { cleanupExpiredTokens } from './services/auth-service';
import { logger } from './lib/logger';

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = createApp();

// 期限切れトークンの定期クリーンアップ（1時間ごと）
setInterval(() => {
  try { cleanupExpiredTokens(); } catch {}
}, 60 * 60 * 1000);

app.listen(PORT, () => {
  logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
});
