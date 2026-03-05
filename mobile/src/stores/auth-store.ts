import { create } from 'zustand';
import { requestLogin, verifyCode, getMe } from '../api/auth';
import { getToken, setToken, removeToken } from '../utils/token';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
  userId: number | null;

  checkAuth: () => Promise<void>;
  login: (email: string) => Promise<void>;
  verify: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  email: null,
  userId: null,

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

  login: async (email: string) => {
    await requestLogin(email);
  },

  verify: async (email: string, code: string) => {
    const result = await verifyCode(email, code);
    await setToken(result.token);
    set({ isAuthenticated: true, email: result.email });
  },

  logout: async () => {
    await removeToken();
    set({ isAuthenticated: false, email: null, userId: null });
  },
}));
