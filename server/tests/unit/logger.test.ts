import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { redactPaths } from '../../src/lib/logger';

/**
 * Magic Link OTP / JWT / メールアドレスがログファイルに素で落ちないことを保証する。
 * logger.ts 本体は transport を伴うため、ここでは `redactPaths` の中身そのものを
 * 新しい pino インスタンスに適用し、出力を文字列として捕捉して検証する。
 */
function makeCapturingLogger() {
  const chunks: string[] = [];
  const stream = {
    write(s: string) {
      chunks.push(s);
    },
  };
  const logger = pino(
    { redact: { paths: redactPaths, censor: '[REDACTED]' } },
    stream as unknown as NodeJS.WritableStream,
  );
  return { logger, output: () => chunks.join('') };
}

describe('logger redaction', () => {
  it('redacts sensitive keys at the payload root', () => {
    const { logger, output } = makeCapturingLogger();

    logger.info(
      {
        email: 'leak-root@example.com',
        otp: 'ROOT_OTP_RAW',
        token: 'ROOT_TOKEN_RAW',
        jwt: 'ROOT_JWT_RAW',
        password: 'ROOT_PW_RAW',
      },
      'root probe',
    );

    const out = output();
    for (const raw of [
      'leak-root@example.com',
      'ROOT_OTP_RAW',
      'ROOT_TOKEN_RAW',
      'ROOT_JWT_RAW',
      'ROOT_PW_RAW',
    ]) {
      expect(out).not.toContain(raw);
    }
    expect(out).toContain('[REDACTED]');
  });

  it('redacts sensitive keys under body / user / arbitrary first-level children', () => {
    const { logger, output } = makeCapturingLogger();

    logger.info(
      {
        body: {
          email: 'leak-body@example.com',
          otp: 'BODY_OTP_RAW',
          token: 'BODY_TOKEN_RAW',
          jwt: 'BODY_JWT_RAW',
          password: 'BODY_PW_RAW',
        },
        user: { email: 'leak-user@example.com' },
      },
      'child probe',
    );

    const out = output();
    for (const raw of [
      'leak-body@example.com',
      'BODY_OTP_RAW',
      'BODY_TOKEN_RAW',
      'BODY_JWT_RAW',
      'BODY_PW_RAW',
      'leak-user@example.com',
    ]) {
      expect(out).not.toContain(raw);
    }
  });

  it('redacts Authorization and Cookie headers on both req.headers and headers', () => {
    const { logger, output } = makeCapturingLogger();

    logger.info(
      {
        req: {
          headers: {
            authorization: 'Bearer REQ_BEARER_RAW',
            cookie: 'session=REQ_COOKIE_RAW',
          },
        },
        headers: {
          authorization: 'Bearer TOP_BEARER_RAW',
          cookie: 'session=TOP_COOKIE_RAW',
        },
      },
      'header probe',
    );

    const out = output();
    for (const raw of [
      'REQ_BEARER_RAW',
      'REQ_COOKIE_RAW',
      'TOP_BEARER_RAW',
      'TOP_COOKIE_RAW',
    ]) {
      expect(out).not.toContain(raw);
    }
  });
});
