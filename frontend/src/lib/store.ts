// Zustand global store: dark mode toggle shared across all layout components.

import { create } from 'zustand';

interface UIStore {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  darkMode: false,
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.darkMode;
      document.documentElement.classList.toggle('dark', next);
      return { darkMode: next };
    }),
  setDarkMode: (value: boolean) => {
    document.documentElement.classList.toggle('dark', value);
    set({ darkMode: value });
  },
}));
