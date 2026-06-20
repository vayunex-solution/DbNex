import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const res = await api.post('/auth/login', { email, password })
          const { accessToken, refreshToken, user } = res.data.data
          set({ user, token: accessToken, refreshToken, isLoading: false })
          return { success: true }
        } catch (err) {
          const error = err.response?.data?.message || 'Login failed.'
          set({ isLoading: false, error })
          return { success: false, error }
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout', { refreshToken: get().refreshToken })
        } catch { /* ignore */ }
        set({ user: null, token: null, refreshToken: null })
      },

      setUser: (user) => set({ user }),

      refreshAccessToken: async () => {
        try {
          const res = await api.post('/auth/refresh', { refreshToken: get().refreshToken })
          const { accessToken, refreshToken } = res.data.data
          set({ token: accessToken, refreshToken })
          return accessToken
        } catch {
          set({ user: null, token: null, refreshToken: null })
          return null
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'dbnex-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
)
