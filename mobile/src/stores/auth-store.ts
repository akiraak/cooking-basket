import { create } from 'zustand';
import { requestLogin as apiRequestMagicCode, verifyCode, getMe } from '../api/auth';
import { getToken, setToken, removeToken } from '../utils/token';

interface RequestLoginOptions {
  reason?: string | null;
  onSuccess?: (() => void) | null;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
  userId: number | null;

  authModalVisible: boolean;
  authModalReason: string | null;
  authModalOnSuccess: (() => void) | null;

  checkAuth: () => Promise<void>;
  sendMagicCode: (email: string) => Promise<void>;
  verify: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;

  requestLogin: (options?: RequestLoginOptions) => void;
  closeAuthModal: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  email: null,
  userId: null,

  authModalVisible: false,
  authModalReason: null,
  authModalOnSuccess: null,

  checkAuth: async () => {
    try {
      const token = await getToken();
      if (!token) {
        set({ isAuthenticated: false, isLoading: false });
        return;
      }
      const user = await getMe();
      set({ isAuthenticated: true, email: user.email, userId: user.userId, isLoading: false });
    } catch {
      await removeToken();
      set({ isAuthenticated: false, email: null, userId: null, isLoading: false });
    }
  },

  sendMagicCode: async (email: string) => {
    await apiRequestMagicCode(email);
  },

  verify: async (email: string, code: string) => {
    const result = await verifyCode(email, code);
    await setToken(result.token);
    const onSuccess = get().authModalOnSuccess;
    set({
      isAuthenticated: true,
      email: result.email,
      authModalVisible: false,
      authModalReason: null,
      authModalOnSuccess: null,
    });
    if (onSuccess) onSuccess();
  },

  logout: async () => {
    await removeToken();
    set({ isAuthenticated: false, email: null, userId: null });
  },

  requestLogin: (options) => {
    set({
      authModalVisible: true,
      authModalReason: options?.reason ?? null,
      authModalOnSuccess: options?.onSuccess ?? null,
    });
  },

  closeAuthModal: () => {
    set({
      authModalVisible: false,
      authModalReason: null,
      authModalOnSuccess: null,
    });
  },
}));
