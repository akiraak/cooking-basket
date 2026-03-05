import axios from 'axios';
import { getToken, removeToken } from '../utils/token';

const client = axios.create({
  baseURL: 'https://basket.chobi.me',
  timeout: 30000,
});

client.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await removeToken();
    }
    return Promise.reject(error);
  },
);

export default client;
