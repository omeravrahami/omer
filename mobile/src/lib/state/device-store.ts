import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

interface DeviceState {
  deviceId: string;
  initDevice: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      deviceId: '',
      initDevice: () => {
        if (!get().deviceId) {
          set({ deviceId: uuidv4() });
        }
      },
    }),
    { name: 'workclock-device', storage: createJSONStorage(() => AsyncStorage) }
  )
);

export function useDeviceId(): string {
  return useDeviceStore((s) => s.deviceId);
}
