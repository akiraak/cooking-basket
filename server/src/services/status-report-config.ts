import { logger } from '../lib/logger';

// 送信時刻のパーサ／フォーマッタ。スケジューラと管理画面表示の両方から使うので、
// admin-service と循環しないように status-report-service / status-report-scheduler と
// 切り離した独立モジュールに置く。

export interface SendTime {
  hour: number;
  minute: number;
}

const DEFAULT_SEND_TIME: SendTime = { hour: 12, minute: 0 };

export function parseStatusReportSendTime(raw: string | undefined): SendTime {
  if (!raw) return DEFAULT_SEND_TIME;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    logger.warn(
      { STATUS_REPORT_SEND_TIME: raw },
      'status_report_invalid_send_time',
    );
    return DEFAULT_SEND_TIME;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    logger.warn(
      { STATUS_REPORT_SEND_TIME: raw },
      'status_report_invalid_send_time',
    );
    return DEFAULT_SEND_TIME;
  }
  return { hour, minute };
}

export function formatSendTime(t: SendTime): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(t.hour)}:${pad(t.minute)}`;
}
