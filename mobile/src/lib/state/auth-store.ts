import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isGuest: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  setGuest: () => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isGuest: false,

      setAuth: (token, user) => set({ token, user, isGuest: false }),

      setGuest: () => set({ token: null, user: null, isGuest: true }),

      logout: () => set({ token: null, user: null, isGuest: false }),

      isAuthenticated: () => {
        const state = get();
        return state.token !== null || state.isGuest;
      },
    }),
    {
      name: 'workclock-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isGuest: state.isGuest,
      }),
    }
  )
);
