import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

interface DeviceState {
  deviceId: string;
  _hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  initDevice: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      deviceId: '',
      _hasHydrated: false,
      setHasHydrated: (val) => set({ _hasHydrated: val }),
      initDevice: () => {
        // Only generate a new ID if there is truly no ID stored
        if (!get().deviceId) {
          set({ deviceId: uuidv4() });
        }
      },
    }),
    {
      name: 'workclock-device',
      storage: createJSONStorage(() => AsyncStorage),
      // Mark as hydrated AFTER AsyncStorage values are loaded
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      // Only persist deviceId, not the hydration flag
      partialize: (state) => ({ deviceId: state.deviceId }),
    }
  )
);

export function useDeviceId(): string {
  return useDeviceStore((s) => s.deviceId);
}
