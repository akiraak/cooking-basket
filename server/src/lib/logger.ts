import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

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

export const logger = pino({
  level,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
});
