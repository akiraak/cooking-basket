import fs from 'node:fs';
import path from 'node:path';
import pino, { type TransportTargetOptions } from 'pino';

const level = process.env.LOG_LEVEL || 'info';
const logFile = process.env.LOG_FILE_PATH;

// 機密情報はログに載せる前に落とす。consumer 側マスクだと誤って他経路で流出しうる。
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  '*.password',
  '*.otp',
  '*.token',
  '*.jwt',
  '*.email',
  'body.password',
  'body.otp',
  'body.token',
  'body.jwt',
  'body.email',
];

// LOG_FILE_PATH が設定されている場合だけ、stdout に加えて日次ローテのファイルにも書く。
// 未設定時（テスト・ローカル開発）は従来通り stdout のみ（同期）。
function buildTransport() {
  if (!logFile) return undefined;

  // pino-roll 側にも mkdir:true を渡すが、起動時点の失敗を早く顕在化させるため先に作る。
  fs.mkdirSync(path.dirname(logFile), { recursive: true });

  const targets: TransportTargetOptions[] = [
    { target: 'pino/file', options: { destination: 1 }, level },
    {
      target: 'pino-roll',
      options: {
        file: logFile,
        frequency: 'daily',
        mkdir: true,
        dateFormat: 'yyyy-MM-dd',
        // active 1 + rotated 6 = 最大 7 ファイル（約 7 日分）
        limit: { count: 6 },
      },
      level,
    },
  ];
  return pino.transport({ targets });
}

const transport = buildTransport();

export const logger = transport
  ? pino({ level, redact: { paths: redactPaths, censor: '[REDACTED]' } }, transport)
  : pino({ level, redact: { paths: redactPaths, censor: '[REDACTED]' } });
