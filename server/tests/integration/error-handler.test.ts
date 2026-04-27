import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../helpers/app';
import { setupTestDatabase } from '../helpers/db';
import { createAuthedUser } from '../helpers/auth';
import * as dishService from '../../src/services/dish-service';

setupTestDatabase();

describe('errorHandler fallback', () => {
  const app = createApp();

  it('returns 500 with masked message when a route throws unexpectedly', async () => {
    const { headers } = createAuthedUser('error-handler@example.com');
    const spy = vi.spyOn(dishService, 'getAllDishes').mockImplementation(() => {
      throw new Error('boom');
    });

    const res = await request(app).get('/api/dishes').set(headers);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe('boom');
    // 旧実装の String(err) は 'Error: boom' を返していたので、漏洩していないことを確認する
    expect(res.body.error).not.toMatch(/^Error:/);

    spy.mockRestore();
  });

  it('falls back to "Internal Server Error" when thrown Error has no message', async () => {
    const { headers } = createAuthedUser('error-handler-blank@example.com');
    const spy = vi.spyOn(dishService, 'getAllDishes').mockImplementation(() => {
      throw new Error('');
    });

    const res = await request(app).get('/api/dishes').set(headers);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      data: null,
      error: 'Internal Server Error',
    });

    spy.mockRestore();
  });
});
