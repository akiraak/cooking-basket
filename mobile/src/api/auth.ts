import { request } from './client';

export const requestLogin = (email: string) =>
  request<{ message: string }>('post', '/api/auth/login', { email });

export const verifyCode = (email: string, code: string) =>
  request<{ token: string; email: string }>('post', '/api/auth/verify-code', { email, code });

export const getMe = () => request<{ userId: number; email: string }>('get', '/api/auth/me');
