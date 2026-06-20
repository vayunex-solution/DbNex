import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'dark', // 'dark' | 'light' | 'system'
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'dbnex-theme' }
  )
)
