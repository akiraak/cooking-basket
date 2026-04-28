import { logger } from '../lib/logger';
import { getStatusReport } from './status-report-service';
import { sendStatusReport } from './status-report-mailer';
import { parseStatusReportSendTime } from './status-report-config';

// 運営者向けステータス報告メールのスケジューラ。
// 既定: 毎日 PT 12:00（コンテナ TZ=America/Los_Angeles 前提でローカル時刻 = PT）。
// 時刻は STATUS_REPORT_SEND_TIME=HH:MM（24h）で上書きできる。タイムゾーンは PT 固定。

export function nextSendTimeLocalDelayMs(now: Date = new Date()): number {
  const { hour, minute } = parseStatusReportSendTime(
    process.env.STATUS_REPORT_SEND_TIME,
  );
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

export async function runStatusReportOnce(): Promise<void> {
  const to = (process.env.OPERATOR_EMAIL || '').trim();
  if (!to) {
    logger.info('status_report_skipped_no_recipient');
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    logger.info('status_report_skipped_no_resend_key');
    return;
  }
  try {
    const report = getStatusReport();
    await sendStatusReport(to, report);
    logger.info(
      { to, errorCount: report.errors.last24hCount },
      'status_report_sent',
    );
  } catch (err) {
    logger.error({ err }, 'status_report_failed');
  }
}

export function scheduleDailyStatusReport(): void {
  // 起動直後の 1 回目は送らない（再起動連打で同じ内容のメールが連発する事故を避ける）。
  // 次の発火時刻を最初のタイミングにする。
  setTimeout(() => {
    runStatusReportOnce();
    setInterval(runStatusReportOnce, 24 * 60 * 60 * 1000);
  }, nextSendTimeLocalDelayMs());
}
