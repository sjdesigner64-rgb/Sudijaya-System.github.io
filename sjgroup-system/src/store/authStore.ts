import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, UserRole } from '@/types'

// Harus sama dengan TOKEN_KEY di api.ts (tidak di-import untuk hindari circular dep)
const AUTH_TOKEN_KEY = 'sjgroup_token'

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
      logout: () => {
        // Hapus token dari localStorage agar tidak auto-login ulang
        localStorage.removeItem(AUTH_TOKEN_KEY)
        set({ user: null, isAuthenticated: false, isLoading: false })
      },
    }),
    {
      name: 'sjgroup-auth',
      // Persist user agar tidak perlu spinner setiap refresh halaman
      partialize: (state) => ({
        theme: state.theme,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
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
