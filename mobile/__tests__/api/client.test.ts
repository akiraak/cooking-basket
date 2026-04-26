import * as SecureStore from 'expo-secure-store';
import { __resetDeviceIdCacheForTests } from '../../src/utils/device-id';
import client from '../../src/api/client';

const secure = SecureStore as jest.Mocked<typeof SecureStore> & { __reset: () => void };

const TOKEN_KEY = 'auth_token';

beforeEach(() => {
  secure.__reset();
  __resetDeviceIdCacheForTests();
  jest.clearAllMocks();
});

async function runRequestInterceptor(config: { headers: Record<string, string> }) {
  const handlers = (client.interceptors.request as unknown as {
    handlers: Array<{ fulfilled: (c: typeof config) => Promise<typeof config> | typeof config } | null>;
  }).handlers.filter(Boolean) as Array<{ fulfilled: (c: typeof config) => Promise<typeof config> | typeof config }>;
  let result = config;
  for (const handler of handlers) {
    result = await handler.fulfilled(result);
  }
  return result;
}

type InterceptedError = {
  response?: { status: number; data?: { error?: unknown } };
  message?: string;
};

async function runResponseErrorInterceptor(error: InterceptedError) {
  const handlers = (client.interceptors.response as unknown as {
    handlers: Array<{ rejected?: (e: InterceptedError) => Promise<unknown> } | null>;
  }).handlers.filter(Boolean) as Array<{ rejected?: (e: InterceptedError) => Promise<unknown> }>;
  for (const handler of handlers) {
    if (handler.rejected) {
      try {
        await handler.rejected(error);
      } catch {
        // interceptors re-reject the error; swallow for test purposes
      }
    }
  }
}

describe('api client', () => {
  describe('request interceptor', () => {
    it('attaches Authorization header (and no X-Device-Id) when a token is present', async () => {
      await secure.setItemAsync(TOKEN_KEY, 'jwt-token');

      const result = await runRequestInterceptor({ headers: {} });

      expect(result.headers.Authorization).toBe('Bearer jwt-token');
      expect(result.headers['X-Device-Id']).toBeUndefined();
    });

    it('attaches X-Device-Id when no token is stored', async () => {
      const result = await runRequestInterceptor({ headers: {} });

      expect(result.headers.Authorization).toBeUndefined();
      expect(result.headers['X-Device-Id']).toBeTruthy();
    });
  });

  describe('response interceptor', () => {
    it('removes the stored token on 401', async () => {
      await secure.setItemAsync(TOKEN_KEY, 'jwt-token');

      await runResponseErrorInterceptor({ response: { status: 401 } });

      expect(secure.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
      expect(await secure.getItemAsync(TOKEN_KEY)).toBeNull();
    });

    it('keeps the token on non-401 errors', async () => {
      await secure.setItemAsync(TOKEN_KEY, 'jwt-token');

      await runResponseErrorInterceptor({ response: { status: 500 } });

      expect(secure.deleteItemAsync).not.toHaveBeenCalled();
      expect(await secure.getItemAsync(TOKEN_KEY)).toBe('jwt-token');
    });

    it("rewrites error.message from response data.error when it's a non-empty string", async () => {
      const error: InterceptedError = {
        message: 'Request failed with status code 401',
        response: { status: 401, data: { error: 'コードが無効または期限切れです' } },
      };

      await runResponseErrorInterceptor(error);

      expect(error.message).toBe('コードが無効または期限切れです');
    });

    it('leaves error.message untouched when response has no error string', async () => {
      const error: InterceptedError = {
        message: 'Network Error',
        response: { status: 500, data: {} },
      };

      await runResponseErrorInterceptor(error);

      expect(error.message).toBe('Network Error');
    });

    it('leaves error.message untouched when data.error is not a string', async () => {
      const error: InterceptedError = {
        message: 'Request failed with status code 400',
        response: { status: 400, data: { error: { code: 1 } } },
      };

      await runResponseErrorInterceptor(error);

      expect(error.message).toBe('Request failed with status code 400');
    });
  });
});
