import { useEffect } from 'react'
import { getCurrentUser, hasValidToken } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { registerUnauthorizedHandler } from '@/config/api'

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, setUser, setLoading } = useAuthStore()

  // Register handler 401 global (sekali saja saat mount)
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      useAuthStore.getState().logout()
    })
  }, [])

  // Validasi sesi setiap kali isLoading bernilai true (awal load / setelah rehydrate)
  useEffect(() => {
    if (!isLoading) return

    // Token tidak ada atau sudah kadaluarsa → logout langsung tanpa API call
    if (!hasValidToken()) {
      setUser(null)
      return
    }

    // Token valid → verifikasi ke server
    getCurrentUser()
      .then((profile) => {
        // null hanya dikembalikan jika server mengirim 401 (token ditolak)
        setUser(profile?.isActive ? profile : null)
      })
      .catch(() => {
        // Network error / server restart / timeout:
        // Jangan logout — gunakan data user yang sudah di-cache (persist)
        // Hanya tandai loading selesai agar UI tidak stuck
        setLoading(false)
      })
  }, [isLoading, setUser, setLoading])

  return { user, isAuthenticated, isLoading }
}
