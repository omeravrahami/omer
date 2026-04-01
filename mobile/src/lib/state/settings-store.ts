import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Deduction {
  id: string;
  name: string;
  amount: number;
  type: 'fixed' | 'percent'; // fixed = ₪ amount, percent = % of gross pay
}

export interface OneTimeAddition {
  id: string;
  month: string;      // 'YYYY-MM'
  name: string;       // e.g. 'בונוס', 'מתנת חג'
  amount: number;
  type: 'bonus' | 'gift';  // bonus = בונוס, gift = מתנה/גיפט קארד
}

interface SettingsState {
  _hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  hourlyRate: number;
  currency: string;
  language: string;
  taxCountry: string;
  region: string;
  isPremium: boolean;
  subscriptionStatus: string;
  planType: string;
  dailyGoalHours: number;
  weeklyGoalHours: number;
  defaultBreakMinutes: number;
  showSalaryOnDashboard: boolean;
  showCharacter: boolean;
  themeMode: 'light' | 'dark';
  onboardingCompleted: boolean;
  deductions: Deduction[];
  carBenefitMonthly: number;
  taxCreditPoints: number;
  trainingFundValue: number;
  trainingFundType: 'percent' | 'fixed';
  transportationValue: number;
  transportationType: 'percent' | 'fixed';
  overtimeEnabled: boolean;
  overtimeMode: 'daily' | 'monthly';
  carGrossupMonthly: number;
  oneTimeAdditions: OneTimeAddition[];
  employerPensionRate: number;

  updateSettings: (partial: Partial<Omit<SettingsState, 'updateSettings' | 'setOnboardingCompleted' | 'addDeduction' | 'removeDeduction' | 'updateDeduction' | 'addOneTimeAddition' | 'removeOneTimeAddition'>>) => void;
  setOnboardingCompleted: (val: boolean) => void;
  addDeduction: (d: Omit<Deduction, 'id'>) => void;
  removeDeduction: (id: string) => void;
  updateDeduction: (id: string, partial: Partial<Omit<Deduction, 'id'>>) => void;
  addOneTimeAddition: (a: Omit<OneTimeAddition, 'id'>) => void;
  removeOneTimeAddition: (id: string) => void;
}

let _idSeq = Date.now();
function uid() { return String(++_idSeq); }

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      setHasHydrated: (val) => set({ _hasHydrated: val }),
      hourlyRate: 50,
      currency: 'ILS',
      language: 'he',
      taxCountry: 'IL',
      region: 'IL',
      isPremium: false,
      subscriptionStatus: 'free',
      planType: 'free',
      dailyGoalHours: 8,
      weeklyGoalHours: 40,
      defaultBreakMinutes: 30,
      showSalaryOnDashboard: true,
      showCharacter: true,
      themeMode: 'light',
      onboardingCompleted: false,
      deductions: [],
      carBenefitMonthly: 0,
      taxCreditPoints: 2.25,
      trainingFundValue: 0,
      trainingFundType: 'percent',
      transportationValue: 0,
      transportationType: 'fixed',
      overtimeEnabled: false,
      overtimeMode: 'daily',
      carGrossupMonthly: 0,
      oneTimeAdditions: [],
      employerPensionRate: 6.5,

      updateSettings: (partial) => set(partial),
      setOnboardingCompleted: (val) => set({ onboardingCompleted: val }),

      addDeduction: (d) =>
        set((s) => ({ deductions: [...s.deductions, { ...d, id: uid() }] })),

      removeDeduction: (id) =>
        set((s) => ({ deductions: s.deductions.filter((d) => d.id !== id) })),

      updateDeduction: (id, partial) =>
        set((s) => ({
          deductions: s.deductions.map((d) => (d.id === id ? { ...d, ...partial } : d)),
        })),

      addOneTimeAddition: (a) =>
        set((s) => ({ oneTimeAdditions: [...s.oneTimeAdditions, { ...a, id: uid() }] })),

      removeOneTimeAddition: (id) =>
        set((s) => ({ oneTimeAdditions: s.oneTimeAdditions.filter((a) => a.id !== id) })),
    }),
    {
      name: 'workclock-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        const { _hasHydrated, setHasHydrated, ...rest } = state;
        return rest as Omit<SettingsState, '_hasHydrated' | 'setHasHydrated'>;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/** Helper: calculate total deductions amount from gross pay */
export function calcDeductions(grossPay: number, deductions: Deduction[]): number {
  return deductions.reduce((sum, d) => {
    return sum + (d.type === 'percent' ? (d.amount / 100) * grossPay : d.amount);
  }, 0);
}
