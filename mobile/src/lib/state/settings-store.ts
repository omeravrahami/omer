import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Deduction {
  id: string;
  name: string;
  amount: number;
  type: 'fixed' | 'percent'; // fixed = ₪ amount, percent = % of gross pay
}

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
  deductions: Deduction[];

  updateSettings: (partial: Partial<Omit<SettingsState, 'updateSettings' | 'setOnboardingCompleted' | 'togglePro' | 'addDeduction' | 'removeDeduction' | 'updateDeduction'>>) => void;
  setOnboardingCompleted: (val: boolean) => void;
  togglePro: () => void;
  addDeduction: (d: Omit<Deduction, 'id'>) => void;
  removeDeduction: (id: string) => void;
  updateDeduction: (id: string, partial: Partial<Omit<Deduction, 'id'>>) => void;
}

let _idSeq = Date.now();
function uid() { return String(++_idSeq); }

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
      deductions: [],

      updateSettings: (partial) => set(partial),
      setOnboardingCompleted: (val) => set({ onboardingCompleted: val }),
      togglePro: () => set({ isPro: !get().isPro }),

      addDeduction: (d) =>
        set((s) => ({ deductions: [...s.deductions, { ...d, id: uid() }] })),

      removeDeduction: (id) =>
        set((s) => ({ deductions: s.deductions.filter((d) => d.id !== id) })),

      updateDeduction: (id, partial) =>
        set((s) => ({
          deductions: s.deductions.map((d) => (d.id === id ? { ...d, ...partial } : d)),
        })),
    }),
    { name: 'workclock-settings', storage: createJSONStorage(() => AsyncStorage) }
  )
);

/** Helper: calculate total deductions amount from gross pay */
export function calcDeductions(grossPay: number, deductions: Deduction[]): number {
  return deductions.reduce((sum, d) => {
    return sum + (d.type === 'percent' ? (d.amount / 100) * grossPay : d.amount);
  }, 0);
}
