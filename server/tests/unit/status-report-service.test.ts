import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/logs-service', async (importActual) => {
  const actual = await importActual<typeof import('../../src/services/logs-service')>();
  return {
    ...actual,
    summarizeErrorsInWindow: vi.fn(() => ({ count: 0, samples: [] as string[] })),
  };
});

import { getDatabase } from '../../src/database';
import { summarizeErrorsInWindow } from '../../src/services/logs-service';
import { getStatusReport } from '../../src/services/status-report-service';
import { setupTestDatabase } from '../helpers/db';

setupTestDatabase();

function jstDate(now: Date = new Date()): string {
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000;
  return new Date(jstMs).toISOString().slice(0, 10);
}

const summarizeMock = vi.mocked(summarizeErrorsInWindow);

describe('status-report-service / getStatusReport', () => {
  beforeEach(() => {
    summarizeMock.mockReset();
    summarizeMock.mockReturnValue({ count: 0, samples: [] });
  });

  afterEach(() => {
    summarizeMock.mockReset();
  });

  it('returns dashboard / previousJstDay / system fields wired to the DB', () => {
    const db = getDatabase();
    const yesterdayJst = jstDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

    const userId = Number(
      db.prepare("INSERT INTO users (email) VALUES (?)").run('a@test').lastInsertRowid,
    );
    db.prepare("INSERT INTO users (email) VALUES (?)").run('b@test');
    db.prepare("INSERT INTO shopping_items (user_id, name) VALUES (?, ?)").run(userId, 'milk');
    db.prepare("INSERT INTO dishes (user_id, name) VALUES (?, ?)").run(userId, 'curry');
    const insertQuota = db.prepare(
      'INSERT INTO ai_quota (key, date, count) VALUES (?, ?, ?)',
    );
    insertQuota.run('user:1', yesterdayJst, 7);
    insertQuota.run(`device:${'a'.repeat(64)}`, yesterdayJst, 2);

    const report = getStatusReport();

    expect(report.dashboard.totalUsers).toBe(2);
    expect(report.dashboard.totalItems).toBe(1);
    expect(report.dashboard.totalDishes).toBe(1);
    expect(report.jstDateForAi).toBe(yesterdayJst);
    expect(report.ai.previousJstDay).toEqual({
      total_calls: 9,
      unique_keys: 2,
      user_calls: 7,
      guest_calls: 2,
      user_keys: 1,
      guest_keys: 1,
    });
    // 直近 7 日合計（DESC で先頭から 7 件 sum）。今日の row が無いので前日 9 のみ。
    expect(report.ai.last7DaysTotalCalls).toBe(9);
    expect(report.ai.limits).toEqual({ user: 20, guest: 3 });
    expect(report.errors).toEqual({ last24hCount: 0, last24hSamples: [] });
    expect(report.system.nodeVersion).toBe(process.version);
    expect(report.dateLabel).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns zeros for an empty DB and no errors', () => {
    const report = getStatusReport();
    expect(report.dashboard.totalUsers).toBe(0);
    expect(report.ai.previousJstDay.total_calls).toBe(0);
    expect(report.ai.last7DaysTotalCalls).toBe(0);
    expect(report.errors.last24hCount).toBe(0);
  });

  it('forwards error count and samples from logs-service', () => {
    summarizeMock.mockReturnValueOnce({
      count: 3,
      samples: ['boom-1', 'boom-2', 'boom-3'],
    });
    const report = getStatusReport();
    expect(report.errors).toEqual({
      last24hCount: 3,
      last24hSamples: ['boom-1', 'boom-2', 'boom-3'],
    });
  });

  it('asks logs-service for a 24h window with up to 5 samples', () => {
    const fixedNow = new Date('2026-04-28T19:00:00.000Z');
    getStatusReport(fixedNow);
    expect(summarizeMock).toHaveBeenCalledTimes(1);
    const [sinceMs, sampleLimit] = summarizeMock.mock.calls[0];
    expect(sinceMs).toBe(fixedNow.getTime() - 24 * 60 * 60 * 1000);
    expect(sampleLimit).toBe(5);
  });
});
