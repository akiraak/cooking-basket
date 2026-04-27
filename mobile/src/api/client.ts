import axios, { type AxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config/api-endpoint';
import type { ApiResponse } from '../types/api';
import { getToken, removeToken } from '../utils/token';
import { getDeviceId } from '../utils/device-id';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

client.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    try {
      const deviceId = await getDeviceId();
      config.headers['X-Device-Id'] = deviceId;
    } catch {
      // device id is best-effort; server endpoints that need it will 400
    }
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await removeToken();
    }
    const serverMessage = error.response?.data?.error;
    if (typeof serverMessage === 'string' && serverMessage.length > 0) {
      error.message = serverMessage;
    }
    return Promise.reject(error);
  },
);

type Method = 'get' | 'post' | 'put' | 'delete';

export async function request<T>(
  method: Method,
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await client.request<ApiResponse<T>>({ method, url, data: body, ...config });
  if (!res.data.success) throw new Error(res.data.error ?? 'リクエストに失敗しました');
  return res.data.data;
}

export default client;
