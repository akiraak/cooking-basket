const PRODUCTION_API_URL = 'https://basket.chobi.me';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? PRODUCTION_API_URL;

export const isLocalServer = API_BASE_URL !== PRODUCTION_API_URL;

export const localServerLabel: string | null = (() => {
  if (!isLocalServer) return null;
  const match = API_BASE_URL.match(/^https?:\/\/([^/]+)/);
  return match ? match[1] : API_BASE_URL;
})();
