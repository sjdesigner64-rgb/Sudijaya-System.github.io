import { api, TOKEN_KEY } from '@/config/api'
import type { User } from '@/types'

interface LoginResponse {
  token: string
  user: { id: string }
}

export const loginWithEmail = async (email: string, password: string) => {
  const res = await api.post<LoginResponse>('/auth/login', { email, password })
  localStorage.setItem(TOKEN_KEY, res.data.token)
  return { user: { uid: res.data.user.id } }
}

export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    const res = await api.get(`/users/${userId}`)
    return res.data as User
  } catch {
    return null
  }
}

export const logoutUser = async () => {
  localStorage.removeItem(TOKEN_KEY)
}

interface AuthUser {
  uid: string
}

const decodeUserFromToken = (): AuthUser | null => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { sub: string; exp: number }
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(TOKEN_KEY)
      return null
    }
    return { uid: payload.sub }
  } catch {
    return null
  }
}

export const onAuthChanged = (callback: (user: AuthUser | null) => void) => {
  callback(decodeUserFromToken())
  return () => {}
}
