import { useEffect } from 'react'
import { getCurrentUser, hasValidToken } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, setUser } = useAuthStore()

  useEffect(() => {
    // Sudah diinisialisasi (login/logout sudah dipanggil), skip
    if (!isLoading) return

    if (!hasValidToken()) {
      setUser(null)
      return
    }

    getCurrentUser().then((profile) => {
      setUser(profile?.isActive ? profile : null)
    })
  }, [isLoading, setUser])

  return { user, isAuthenticated, isLoading }
}
