import client from './client';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export async function requestLogin(email: string): Promise<{ message: string }> {
  const res = await client.post<ApiResponse<{ message: string }>>('/api/auth/login', { email });
  if (!res.data.success) throw new Error(res.data.error ?? 'ログインに失敗しました');
  return res.data.data;
}

export async function verifyCode(email: string, code: string): Promise<{ token: string; email: string }> {
  const res = await client.post<ApiResponse<{ token: string; email: string }>>('/api/auth/verify-code', { email, code });
  if (!res.data.success) throw new Error(res.data.error ?? '認証に失敗しました');
  return res.data.data;
}

export async function getMe(): Promise<{ userId: number; email: string }> {
  const res = await client.get<ApiResponse<{ userId: number; email: string }>>('/api/auth/me');
  if (!res.data.success) throw new Error(res.data.error ?? 'ユーザー情報の取得に失敗しました');
  return res.data.data;
}
