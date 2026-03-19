import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  hourlyRate: number;
  currency: string;
  dailyGoalHours: number;
  weeklyGoalHours: number;
  defaultBreakMinutes: number;
  showSalaryOnDashboard: boolean;
  themeMode: 'light' | 'dark';
  isPro: boolean;
  onboardingCompleted: boolean;
  updateSettings: (partial: Partial<Omit<SettingsState, 'updateSettings' | 'setOnboardingCompleted' | 'togglePro'>>) => void;
  setOnboardingCompleted: (val: boolean) => void;
  togglePro: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      hourlyRate: 50,
      currency: 'ILS',
      dailyGoalHours: 8,
      weeklyGoalHours: 40,
      defaultBreakMinutes: 30,
      showSalaryOnDashboard: true,
      themeMode: 'light',
      isPro: false,
      onboardingCompleted: false,
      updateSettings: (partial) => set(partial),
      setOnboardingCompleted: (val) => set({ onboardingCompleted: val }),
      togglePro: () => set({ isPro: !get().isPro }),
    }),
    { name: 'workclock-settings', storage: createJSONStorage(() => AsyncStorage) }
  )
);
