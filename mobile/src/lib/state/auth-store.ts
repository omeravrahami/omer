import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  lastLoginAt: string | null;
  isEmailVerified: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isGuest: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  setGuest: () => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await SecureStore.getItemAsync(name)) ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
  },
};

// SecureStore is not supported on web — fall back to AsyncStorage there.
const storage =
  Platform.OS === 'web'
    ? createJSONStorage(() => AsyncStorage)
    : createJSONStorage(() => secureStorage);

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isGuest: false,

      setAuth: (token, user) => set({ token, user, isGuest: false }),

      setUser: (user) => set({ user }),

      setGuest: () => set({ token: null, user: null, isGuest: true }),

      logout: () => set({ token: null, user: null, isGuest: false }),

      isAuthenticated: () => {
        const state = get();
        return state.token !== null || state.isGuest;
      },
    }),
    {
      name: 'workclock-auth',
      storage,
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isGuest: state.isGuest,
      }),
    }
  )
);
