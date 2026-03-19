import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Mood = 'great' | 'good' | 'okay' | 'bad';

export interface JournalEntry {
  id: string;
  date: string;       // YYYY-MM-DD
  content: string;    // free text
  mood: Mood | null;
  createdAt: string;  // ISO timestamp
}

interface JournalState {
  entries: JournalEntry[];
  addEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => void;
  updateEntry: (id: string, partial: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>) => void;
  deleteEntry: (id: string) => void;
}

export const useJournalStore = create<JournalState>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (entry) =>
        set((s) => ({
          entries: [
            {
              ...entry,
              id: uuidv4(),
              createdAt: new Date().toISOString(),
            },
            ...s.entries,
          ],
        })),

      updateEntry: (id, partial) =>
        set((s) => ({
          entries: s.entries.map((e) => (e.id === id ? { ...e, ...partial } : e)),
        })),

      deleteEntry: (id) =>
        set((s) => ({
          entries: s.entries.filter((e) => e.id !== id),
        })),
    }),
    { name: 'workclock-journal', storage: createJSONStorage(() => AsyncStorage) }
  )
);
