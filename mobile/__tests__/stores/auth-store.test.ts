jest.mock('../../src/api/auth', () => ({
  requestLogin: jest.fn(),
  verifyCode: jest.fn(),
  getMe: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import * as authApi from '../../src/api/auth';
import { useAuthStore } from '../../src/stores/auth-store';

const auth = authApi as jest.Mocked<typeof authApi>;
const secure = SecureStore as jest.Mocked<typeof SecureStore> & { __reset: () => void };

const TOKEN_KEY = 'auth_token';

beforeEach(() => {
  jest.clearAllMocks();
  secure.__reset();
  useAuthStore.setState({
    isAuthenticated: false,
    isLoading: true,
    email: null,
    userId: null,
    authModalVisible: false,
    authModalReason: null,
    authModalOnSuccess: null,
  });
});

describe('auth-store', () => {
  describe('sendMagicCode', () => {
    it('calls the auth API and does not flip isAuthenticated', async () => {
      auth.requestLogin.mockResolvedValue({ message: 'sent' });

      await useAuthStore.getState().sendMagicCode('user@example.com');

      expect(auth.requestLogin).toHaveBeenCalledWith('user@example.com');
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('verify', () => {
    it('persists token, marks authenticated, closes modal, and fires onSuccess', async () => {
      auth.verifyCode.mockResolvedValue({ token: 'jwt-token', email: 'user@example.com' });
      const onSuccess = jest.fn();
      useAuthStore.setState({
        authModalVisible: true,
        authModalReason: 'AI 回数を増やす',
        authModalOnSuccess: onSuccess,
      });

      await useAuthStore.getState().verify('user@example.com', '123456');

      expect(auth.verifyCode).toHaveBeenCalledWith('user@example.com', '123456');
      expect(secure.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, 'jwt-token');
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.email).toBe('user@example.com');
      expect(state.authModalVisible).toBe(false);
      expect(state.authModalReason).toBeNull();
      expect(state.authModalOnSuccess).toBeNull();
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('logout', () => {
    it('removes token and resets state', async () => {
      await secure.setItemAsync(TOKEN_KEY, 'existing-token');
      useAuthStore.setState({
        isAuthenticated: true,
        email: 'user@example.com',
        userId: 42,
        isLoading: false,
      });

      await useAuthStore.getState().logout();

      expect(secure.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
      expect(await secure.getItemAsync(TOKEN_KEY)).toBeNull();
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.email).toBeNull();
      expect(state.userId).toBeNull();
    });
  });

  describe('checkAuth', () => {
    it('marks unauthenticated when no token is stored', async () => {
      await useAuthStore.getState().checkAuth();

      expect(auth.getMe).not.toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('hydrates user info when token is valid', async () => {
      await secure.setItemAsync(TOKEN_KEY, 'jwt-token');
      auth.getMe.mockResolvedValue({ userId: 7, email: 'user@example.com' });

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.userId).toBe(7);
      expect(state.email).toBe('user@example.com');
      expect(state.isLoading).toBe(false);
    });

    it('clears token when /me fails', async () => {
      await secure.setItemAsync(TOKEN_KEY, 'bad-token');
      auth.getMe.mockRejectedValue(new Error('401'));

      await useAuthStore.getState().checkAuth();

      expect(secure.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.email).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('requestLogin / closeAuthModal', () => {
    it('opens the modal with optional reason and onSuccess', () => {
      const onSuccess = jest.fn();

      useAuthStore.getState().requestLogin({ reason: 'いいねする', onSuccess });

      const state = useAuthStore.getState();
      expect(state.authModalVisible).toBe(true);
      expect(state.authModalReason).toBe('いいねする');
      expect(state.authModalOnSuccess).toBe(onSuccess);
    });

    it('opens the modal without arguments', () => {
      useAuthStore.getState().requestLogin();

      const state = useAuthStore.getState();
      expect(state.authModalVisible).toBe(true);
      expect(state.authModalReason).toBeNull();
      expect(state.authModalOnSuccess).toBeNull();
    });

    it('closeAuthModal clears modal state without firing onSuccess', () => {
      const onSuccess = jest.fn();
      useAuthStore.setState({
        authModalVisible: true,
        authModalReason: 'reason',
        authModalOnSuccess: onSuccess,
      });

      useAuthStore.getState().closeAuthModal();

      const state = useAuthStore.getState();
      expect(state.authModalVisible).toBe(false);
      expect(state.authModalReason).toBeNull();
      expect(state.authModalOnSuccess).toBeNull();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
