import { describe, expect, it, vi } from 'vitest';
import { parseStatusReportSendTime } from '../../src/services/status-report-config';
import { nextSendTimeLocalDelayMs } from '../../src/services/status-report-scheduler';

describe('parseStatusReportSendTime', () => {
  it('returns default 12:00 when env is unset', () => {
    expect(parseStatusReportSendTime(undefined)).toEqual({ hour: 12, minute: 0 });
    expect(parseStatusReportSendTime('')).toEqual({ hour: 12, minute: 0 });
  });

  it('parses HH:MM in 24h form', () => {
    expect(parseStatusReportSendTime('09:30')).toEqual({ hour: 9, minute: 30 });
    expect(parseStatusReportSendTime('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseStatusReportSendTime('00:00')).toEqual({ hour: 0, minute: 0 });
    // 1 桁時も許容
    expect(parseStatusReportSendTime('7:05')).toEqual({ hour: 7, minute: 5 });
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseStatusReportSendTime('  14:30  ')).toEqual({ hour: 14, minute: 30 });
  });

  it('falls back to default for malformed strings', () => {
    expect(parseStatusReportSendTime('noon')).toEqual({ hour: 12, minute: 0 });
    expect(parseStatusReportSendTime('1230')).toEqual({ hour: 12, minute: 0 });
    expect(parseStatusReportSendTime('12:3')).toEqual({ hour: 12, minute: 0 });
    expect(parseStatusReportSendTime('12:00:00')).toEqual({ hour: 12, minute: 0 });
  });

  it('falls back to default for out-of-range hour or minute', () => {
    expect(parseStatusReportSendTime('24:00')).toEqual({ hour: 12, minute: 0 });
    expect(parseStatusReportSendTime('12:60')).toEqual({ hour: 12, minute: 0 });
    expect(parseStatusReportSendTime('99:99')).toEqual({ hour: 12, minute: 0 });
  });
});

describe('nextSendTimeLocalDelayMs', () => {
  const prev = process.env.STATUS_REPORT_SEND_TIME;

  function withEnv(value: string | undefined, body: () => void): void {
    if (value === undefined) {
      delete process.env.STATUS_REPORT_SEND_TIME;
    } else {
      process.env.STATUS_REPORT_SEND_TIME = value;
    }
    try {
      body();
    } finally {
      if (prev === undefined) {
        delete process.env.STATUS_REPORT_SEND_TIME;
      } else {
        process.env.STATUS_REPORT_SEND_TIME = prev;
      }
    }
  }

  it('returns delay until today HH:MM when that has not passed yet', () => {
    withEnv('14:30', () => {
      const now = new Date();
      now.setHours(10, 0, 0, 0);
      const target = new Date(now);
      target.setHours(14, 30, 0, 0);
      expect(nextSendTimeLocalDelayMs(now)).toBe(target.getTime() - now.getTime());
    });
  });

  it('rolls over to tomorrow when HH:MM has already passed today', () => {
    withEnv('09:00', () => {
      const now = new Date();
      now.setHours(15, 0, 0, 0);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      expect(nextSendTimeLocalDelayMs(now)).toBe(tomorrow.getTime() - now.getTime());
    });
  });

  it('rolls over to tomorrow when called exactly at the send time', () => {
    withEnv('12:00', () => {
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(nextSendTimeLocalDelayMs(now)).toBe(tomorrow.getTime() - now.getTime());
    });
  });

  it('uses 12:00 default when env is unset', () => {
    withEnv(undefined, () => {
      const now = new Date();
      now.setHours(8, 0, 0, 0);
      const target = new Date(now);
      target.setHours(12, 0, 0, 0);
      expect(nextSendTimeLocalDelayMs(now)).toBe(target.getTime() - now.getTime());
    });
  });

  it('uses 12:00 default when env value is malformed', () => {
    // logger.warn が出るが副作用なので spy で抑制
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      withEnv('not-a-time', () => {
        const now = new Date();
        now.setHours(10, 0, 0, 0);
        const target = new Date(now);
        target.setHours(12, 0, 0, 0);
        expect(nextSendTimeLocalDelayMs(now)).toBe(target.getTime() - now.getTime());
      });
    } finally {
      spy.mockRestore();
    }
  });
});
