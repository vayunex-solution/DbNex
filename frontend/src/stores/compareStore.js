import { create } from 'zustand'

export const useCompareStore = create((set) => ({
  compareResult: null,
  compareHistoryId: null,
  isComparing: false,
  selectedProject: null,
  filters: {
    category: 'all',
    status: 'all',
    riskLevel: 'all',
    search: '',
  },

  setCompareResult: (result, historyId) =>
    set({ compareResult: result, compareHistoryId: historyId }),

  setIsComparing: (v) => set({ isComparing: v }),

  setSelectedProject: (project) => set({ selectedProject: project }),

  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),

  clearResults: () =>
    set({ compareResult: null, compareHistoryId: null }),
}))
