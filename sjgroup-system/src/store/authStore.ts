import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, UserRole } from '@/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  theme: 'light' | 'dark'
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  toggleTheme: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      theme: 'light',
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'sjgroup-auth',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)

export const getRoleLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    sales: 'Sales',
    fabrikasi: 'Fabrikasi',
    warehouse: 'Warehouse',
    media: 'Media',
  }
  return labels[role]
}
