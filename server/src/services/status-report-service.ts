import {
  getAiQuotaStats,
  getAiQuotaSummaryForDate,
  getDashboardStats,
  getDeployedAt,
  type AiQuotaTodaySummary,
} from './admin-service';
import { getJstDate } from './ai-quota-service';
import { summarizeErrorsInWindow } from './logs-service';

/**
 * 運営者向け定期メール（PT 12:00 / 日次）に載せるステータスサマリ。
 *
 * - PT (America/Los_Angeles) ベースの送信タイミングと、
 *   AI クォータ集計の JST 日跨ぎを分けて扱うため日付ラベルを 2 種類持つ。
 * - エラーは過去 24h、直近 5 件の `msg` のみ抜粋（メール経由の情報漏洩を避ける）。
 */
export interface StatusReport {
  generatedAt: string;
  /** PT (America/Los_Angeles) のメール送信日 'YYYY-MM-DD'。件名の日付に使う */
  dateLabel: string;
  /** AI クォータ集計の対象 JST 日付 'YYYY-MM-DD'。送信時点で完了している前日 JST */
  jstDateForAi: string;
  dashboard: ReturnType<typeof getDashboardStats>;
  ai: {
    previousJstDay: AiQuotaTodaySummary;
    last7DaysTotalCalls: number;
    limits: { user: number; guest: number };
  };
  errors: {
    last24hCount: number;
    last24hSamples: string[];
  };
  system: {
    deployedAt: string | null;
    nodeVersion: string;
  };
}

const SAMPLE_LIMIT = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getPtDateLabel(now: Date = new Date()): string {
  // コンテナの TZ 設定に依存しない（明示的に PT で評価）
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

interface DailyRow {
  date: string;
  total_calls: number;
}

export function getStatusReport(now: Date = new Date()): StatusReport {
  const dashboard = getDashboardStats();

  const aiStats = getAiQuotaStats();
  const previousJstDate = getJstDate(new Date(now.getTime() - ONE_DAY_MS));
  const previousJstDay = getAiQuotaSummaryForDate(previousJstDate);
  const last7DaysTotalCalls = (aiStats.daily as DailyRow[])
    .slice(0, 7)
    .reduce((sum, row) => sum + (row.total_calls ?? 0), 0);

  const errors = summarizeErrorsInWindow(now.getTime() - ONE_DAY_MS, SAMPLE_LIMIT);

  return {
    generatedAt: now.toISOString(),
    dateLabel: getPtDateLabel(now),
    jstDateForAi: previousJstDate,
    dashboard,
    ai: {
      previousJstDay,
      last7DaysTotalCalls,
      limits: aiStats.limits,
    },
    errors: {
      last24hCount: errors.count,
      last24hSamples: errors.samples,
    },
    system: {
      deployedAt: getDeployedAt(),
      nodeVersion: process.version,
    },
  };
}
