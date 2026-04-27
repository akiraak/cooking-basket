import client, { request } from './client';
import type { ApiResponse } from '../types/api';
import type { Ingredient, Recipe } from '../types/models';

export interface SuggestAiData {
  ingredients: Ingredient[];
  recipes: Recipe[];
}

export interface SuggestAiResult extends SuggestAiData {
  remaining: number | null;
}

export class AiQuotaError extends Error {
  remaining: number;
  resetAt: string | null;
  constructor(resetAt: string | null = null) {
    super('ai_quota_exceeded');
    this.name = 'AiQuotaError';
    this.remaining = 0;
    this.resetAt = resetAt;
  }
}

export interface AiQuota {
  remaining: number | null;
  limit: number | null;
  resetAt: string | null;
}

export const getAiQuota = () => request<AiQuota>('get', '/api/ai/quota');

export async function suggestAi(
  dishName: string,
  extraIngredients?: string[],
): Promise<SuggestAiResult> {
  try {
    // Gemini 3 系 preview の tail latency + WSL2/Wi-Fi 経路で client 既定の 30 秒では足りないことがあるため、
    // AI 提案だけ 60 秒に延長する。操作系 API の 30 秒は UX のため維持。
    const res = await client.post<ApiResponse<SuggestAiData>>(
      '/api/ai/suggest',
      { dishName, extraIngredients },
      { timeout: 60000 },
    );
    if (!res.data.success) throw new Error(res.data.error ?? 'AI提案に失敗しました');
    const headerVal = (res.headers ?? {})['x-ai-remaining'];
    const parsed = headerVal != null ? Number(headerVal) : NaN;
    return {
      ingredients: res.data.data.ingredients,
      recipes: res.data.data.recipes,
      remaining: Number.isFinite(parsed) ? parsed : null,
    };
  } catch (e) {
    const err = e as {
      response?: {
        status?: number;
        data?: { error?: string; resetAt?: string | null };
      };
    };
    if (err?.response?.status === 429 && err.response?.data?.error === 'ai_quota_exceeded') {
      throw new AiQuotaError(err.response.data.resetAt ?? null);
    }
    throw e;
  }
}
