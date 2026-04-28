import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const sendMock = vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
vi.mock('resend', () => {
  return {
    Resend: class {
      emails = { send: sendMock };
    },
  };
});

import { createApp } from '../helpers/app';
import { setupTestDatabase } from '../helpers/db';
import {
  createCfAccessHeaders,
  startCfAccessStub,
  stopCfAccessStub,
} from '../helpers/auth';

setupTestDatabase();

beforeAll(async () => {
  await startCfAccessStub();
});

afterAll(async () => {
  await stopCfAccessStub();
});

describe('GET /api/admin/status-report/config', () => {
  const app = createApp();
  const prevOperator = process.env.OPERATOR_EMAIL;
  const prevSendTime = process.env.STATUS_REPORT_SEND_TIME;

  function restoreEnv(): void {
    if (prevOperator === undefined) delete process.env.OPERATOR_EMAIL;
    else process.env.OPERATOR_EMAIL = prevOperator;
    if (prevSendTime === undefined) delete process.env.STATUS_REPORT_SEND_TIME;
    else process.env.STATUS_REPORT_SEND_TIME = prevSendTime;
  }

  afterAll(() => {
    restoreEnv();
  });

  it('returns 401 without Cf-Access-Jwt-Assertion header', async () => {
    const res = await request(app).get('/api/admin/status-report/config');
    expect(res.status).toBe(401);
  });

  it('reflects OPERATOR_EMAIL and STATUS_REPORT_SEND_TIME env vars', async () => {
    process.env.OPERATOR_EMAIL = 'op@test.local';
    process.env.STATUS_REPORT_SEND_TIME = '07:30';
    const headers = await createCfAccessHeaders('admin@test.local');
    const res = await request(app)
      .get('/api/admin/status-report/config')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      recipientConfigured: true,
      sendTime: '07:30',
      resendConfigured: true,
    });
    restoreEnv();
  });

  it('flags unset OPERATOR_EMAIL and falls back to 12:00 for missing send time', async () => {
    delete process.env.OPERATOR_EMAIL;
    delete process.env.STATUS_REPORT_SEND_TIME;
    const headers = await createCfAccessHeaders('admin@test.local');
    const res = await request(app)
      .get('/api/admin/status-report/config')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data.recipientConfigured).toBe(false);
    expect(res.body.data.sendTime).toBe('12:00');
    restoreEnv();
  });
});

describe('POST /api/admin/status-report/send', () => {
  const app = createApp();
  const prevOperator = process.env.OPERATOR_EMAIL;

  beforeEach(() => {
    sendMock.mockClear();
    sendMock.mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
    process.env.OPERATOR_EMAIL = 'operator@test.local';
  });

  afterAll(() => {
    if (prevOperator === undefined) {
      delete process.env.OPERATOR_EMAIL;
    } else {
      process.env.OPERATOR_EMAIL = prevOperator;
    }
  });

  it('returns 401 without Cf-Access-Jwt-Assertion header', async () => {
    const res = await request(app).post('/api/admin/status-report/send').send({});
    expect(res.status).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends to OPERATOR_EMAIL when authenticated', async () => {
    const headers = await createCfAccessHeaders('admin@test.local');
    const res = await request(app)
      .post('/api/admin/status-report/send')
      .set(headers)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.to).toBe('operator@test.local');
    expect(typeof res.body.data.errorCount).toBe('number');
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].to).toBe('operator@test.local');
  });

  it('honors body.to override over OPERATOR_EMAIL', async () => {
    const headers = await createCfAccessHeaders('admin@test.local');
    const res = await request(app)
      .post('/api/admin/status-report/send')
      .set(headers)
      .send({ to: 'override@test.local' });

    expect(res.status).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].to).toBe('override@test.local');
  });

  it('returns 400 no_recipient when both OPERATOR_EMAIL and body.to are missing', async () => {
    delete process.env.OPERATOR_EMAIL;
    const headers = await createCfAccessHeaders('admin@test.local');
    const res = await request(app)
      .post('/api/admin/status-report/send')
      .set(headers)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_recipient');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 500 send_failed when Resend rejects', async () => {
    sendMock.mockRejectedValueOnce(new Error('boom'));
    const headers = await createCfAccessHeaders('admin@test.local');
    const res = await request(app)
      .post('/api/admin/status-report/send')
      .set(headers)
      .send({});

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('send_failed');
  });
});
