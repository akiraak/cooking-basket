import { getResend } from './auth-service';
import type { StatusReport } from './status-report-service';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildStatusReportSubject(report: StatusReport): string {
  const errorCount = report.errors.last24hCount;
  const prefix = errorCount > 0 ? `[ERROR ${errorCount}] ` : '';
  return `${prefix}[お料理バスケット] サービス状況 ${report.dateLabel}`;
}

export function buildStatusReportText(report: StatusReport): string {
  const lines: string[] = [];
  lines.push(`お料理バスケット サービス状況レポート`);
  lines.push(`生成: ${report.generatedAt}`);
  lines.push(`日付 (PT): ${report.dateLabel}`);
  lines.push('');
  lines.push('— 利用状況 —');
  lines.push(`総ユーザー数: ${report.dashboard.totalUsers}`);
  lines.push(`総食材数: ${report.dashboard.totalItems}`);
  lines.push(`総料理数: ${report.dashboard.totalDishes}`);
  lines.push(`総購入履歴: ${report.dashboard.totalPurchases}`);
  lines.push(`直近 7 日: 新規ユーザー ${report.dashboard.recentUsersCount} / 新規食材 ${report.dashboard.recentItemsCount}`);
  lines.push(`24h 以内アクティブ: ${report.dashboard.activeUsersToday}`);
  lines.push('');
  lines.push(`— AI 利用 (前日 JST = ${report.jstDateForAi}) —`);
  lines.push(`合計コール: ${report.ai.previousJstDay.total_calls}`);
  lines.push(`  user: ${report.ai.previousJstDay.user_calls} (${report.ai.previousJstDay.user_keys} keys)`);
  lines.push(`  guest: ${report.ai.previousJstDay.guest_calls} (${report.ai.previousJstDay.guest_keys} keys)`);
  lines.push(`直近 7 日合計コール: ${report.ai.last7DaysTotalCalls}`);
  lines.push(`上限: user ${report.ai.limits.user} / guest ${report.ai.limits.guest}`);
  lines.push('');
  lines.push(`— エラー (直近 24h) —`);
  lines.push(`件数: ${report.errors.last24hCount}`);
  if (report.errors.last24hSamples.length > 0) {
    lines.push('直近の msg:');
    for (const msg of report.errors.last24hSamples) {
      lines.push(`  - ${msg}`);
    }
  }
  lines.push('');
  lines.push('— システム —');
  lines.push(`Node: ${report.system.nodeVersion}`);
  lines.push(`Deployed: ${report.system.deployedAt ?? '(未設定)'}`);
  return lines.join('\n');
}

export function buildStatusReportHtml(report: StatusReport): string {
  const cellStyle = 'padding: 6px 12px; border-bottom: 1px solid #eee;';
  const labelStyle = `${cellStyle} color: #666;`;
  const valueStyle = `${cellStyle} text-align: right; font-variant-numeric: tabular-nums;`;
  const headerStyle = 'margin: 16px 0 8px; font-size: 14px; color: #333; border-bottom: 2px solid #ddd; padding-bottom: 4px;';

  const dashboardRows: Array<[string, string | number]> = [
    ['総ユーザー数', report.dashboard.totalUsers],
    ['総食材数', report.dashboard.totalItems],
    ['総料理数', report.dashboard.totalDishes],
    ['総購入履歴', report.dashboard.totalPurchases],
    ['直近 7 日 新規ユーザー', report.dashboard.recentUsersCount],
    ['直近 7 日 新規食材', report.dashboard.recentItemsCount],
    ['24h 以内アクティブ', report.dashboard.activeUsersToday],
  ];
  const aiRows: Array<[string, string | number]> = [
    ['前日合計コール', report.ai.previousJstDay.total_calls],
    ['  user', `${report.ai.previousJstDay.user_calls} (${report.ai.previousJstDay.user_keys} keys)`],
    ['  guest', `${report.ai.previousJstDay.guest_calls} (${report.ai.previousJstDay.guest_keys} keys)`],
    ['直近 7 日合計', report.ai.last7DaysTotalCalls],
    ['上限 user / guest', `${report.ai.limits.user} / ${report.ai.limits.guest}`],
  ];

  const renderRows = (rows: Array<[string, string | number]>): string =>
    rows
      .map(
        ([label, value]) =>
          `<tr><td style="${labelStyle}">${escapeHtml(label)}</td><td style="${valueStyle}">${escapeHtml(String(value))}</td></tr>`,
      )
      .join('');

  const errorSamples = report.errors.last24hSamples
    .map((msg) => `<li style="margin: 4px 0;">${escapeHtml(msg)}</li>`)
    .join('');

  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 16px; color: #222;">
  <h2 style="margin: 0 0 4px;">お料理バスケット サービス状況</h2>
  <div style="color: #888; font-size: 12px;">${escapeHtml(report.dateLabel)} (PT) / 生成: ${escapeHtml(report.generatedAt)}</div>

  <h3 style="${headerStyle}">利用状況</h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">${renderRows(dashboardRows)}</table>

  <h3 style="${headerStyle}">AI 利用 (前日 JST = ${escapeHtml(report.jstDateForAi)})</h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">${renderRows(aiRows)}</table>

  <h3 style="${headerStyle}">エラー (直近 24h)</h3>
  <div style="font-size: 13px;">件数: <strong>${report.errors.last24hCount}</strong></div>
  ${
    errorSamples
      ? `<ul style="font-size: 13px; padding-left: 20px;">${errorSamples}</ul>`
      : ''
  }

  <h3 style="${headerStyle}">システム</h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
    <tr><td style="${labelStyle}">Node</td><td style="${valueStyle}">${escapeHtml(report.system.nodeVersion)}</td></tr>
    <tr><td style="${labelStyle}">Deployed</td><td style="${valueStyle}">${escapeHtml(report.system.deployedAt ?? '(未設定)')}</td></tr>
  </table>
</body></html>`;
}

export async function sendStatusReport(to: string, report: StatusReport): Promise<void> {
  await getResend().emails.send({
    from: process.env.EMAIL_FROM || 'noreply@chobi.me',
    to,
    subject: buildStatusReportSubject(report),
    text: buildStatusReportText(report),
    html: buildStatusReportHtml(report),
  });
}
