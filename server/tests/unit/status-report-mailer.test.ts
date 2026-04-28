import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
vi.mock('resend', () => {
  return {
    Resend: class {
      emails = { send: sendMock };
    },
  };
});

import {
  buildStatusReportHtml,
  buildStatusReportSubject,
  buildStatusReportText,
  sendStatusReport,
} from '../../src/services/status-report-mailer';
import type { StatusReport } from '../../src/services/status-report-service';

function makeReport(overrides: Partial<StatusReport> = {}): StatusReport {
  const base: StatusReport = {
    generatedAt: '2026-04-28T19:00:00.000Z',
    dateLabel: '2026-04-28',
    jstDateForAi: '2026-04-28',
    dashboard: {
      totalUsers: 5,
      totalItems: 10,
      totalDishes: 3,
      totalPurchases: 2,
      recentUsersCount: 1,
      recentItemsCount: 4,
      activeUsersToday: 2,
    },
    ai: {
      previousJstDay: {
        total_calls: 12,
        unique_keys: 4,
        user_calls: 10,
        guest_calls: 2,
        user_keys: 3,
        guest_keys: 1,
      },
      last7DaysTotalCalls: 50,
      limits: { user: 20, guest: 3 },
    },
    errors: { last24hCount: 0, last24hSamples: [] },
    system: { deployedAt: '2026-04-28 PDT', nodeVersion: 'v22.0.0' },
  };
  return { ...base, ...overrides };
}

describe('status-report-mailer / subject', () => {
  it('uses no prefix when there are no errors', () => {
    expect(buildStatusReportSubject(makeReport())).toBe(
      '[お料理バスケット] サービス状況 2026-04-28',
    );
  });

  it('prefixes [ERROR n] when errors > 0', () => {
    const report = makeReport({
      errors: { last24hCount: 7, last24hSamples: [] },
    });
    expect(buildStatusReportSubject(report)).toBe(
      '[ERROR 7] [お料理バスケット] サービス状況 2026-04-28',
    );
  });
});

describe('status-report-mailer / text body', () => {
  it('includes dashboard / ai / system fields', () => {
    const text = buildStatusReportText(makeReport());
    expect(text).toContain('総ユーザー数: 5');
    expect(text).toContain('総食材数: 10');
    expect(text).toContain('合計コール: 12');
    expect(text).toContain('user: 10 (3 keys)');
    expect(text).toContain('guest: 2 (1 keys)');
    expect(text).toContain('直近 7 日合計コール: 50');
    expect(text).toContain('上限: user 20 / guest 3');
    expect(text).toContain('Node: v22.0.0');
    expect(text).toContain('Deployed: 2026-04-28 PDT');
  });

  it('lists error msg samples when present', () => {
    const text = buildStatusReportText(
      makeReport({
        errors: { last24hCount: 2, last24hSamples: ['boom-a', 'boom-b'] },
      }),
    );
    expect(text).toContain('件数: 2');
    expect(text).toContain('  - boom-a');
    expect(text).toContain('  - boom-b');
  });

  it('shows (未設定) for missing deployedAt', () => {
    const text = buildStatusReportText(
      makeReport({ system: { deployedAt: null, nodeVersion: 'v22.0.0' } }),
    );
    expect(text).toContain('Deployed: (未設定)');
  });
});

describe('status-report-mailer / html body', () => {
  it('html-escapes msg samples to avoid HTML injection', () => {
    const html = buildStatusReportHtml(
      makeReport({
        errors: {
          last24hCount: 1,
          last24hSamples: ['<script>alert(1)</script>'],
        },
      }),
    );
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('renders dashboard numbers in the table body', () => {
    const html = buildStatusReportHtml(makeReport());
    expect(html).toContain('総ユーザー数');
    expect(html).toContain('>5<');
  });
});

describe('status-report-mailer / sendStatusReport', () => {
  beforeEach(() => {
    sendMock.mockClear();
    sendMock.mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
  });

  it('sends via Resend with from / to / subject / text / html', async () => {
    await sendStatusReport(
      'to@example.com',
      makeReport({ errors: { last24hCount: 2, last24hSamples: ['boom'] } }),
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe('to@example.com');
    expect(arg.subject).toBe('[ERROR 2] [お料理バスケット] サービス状況 2026-04-28');
    expect(arg.text).toContain('件数: 2');
    expect(arg.text).toContain('boom');
    expect(arg.html).toContain('boom');
    // tests/setup.ts は EMAIL_FROM='noreply@test.local' を設定する
    expect(arg.from).toBe('noreply@test.local');
  });
});
