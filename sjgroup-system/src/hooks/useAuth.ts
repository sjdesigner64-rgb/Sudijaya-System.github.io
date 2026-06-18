import { useEffect } from 'react'
import { onAuthChanged, getUserProfile } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthChanged(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.uid)
        if (profile && profile.isActive) {
          setUser(profile)
        } else {
          setUser(null)
        }
      } else {
        setUser(null)
        setLoading(false)
      }
    })
    return unsubscribe
  }, [setUser, setLoading])

  return { user, isAuthenticated, isLoading }
}
