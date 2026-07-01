import { api, TOKEN_KEY } from '@/config/api'
import type { User } from '@/types'

interface LoginResponse {
  token: string
  user: User
}

export const loginWithEmail = async (email: string, password: string): Promise<User> => {
  const res = await api.post<LoginResponse>('/auth/login', { email, password })
  localStorage.setItem(TOKEN_KEY, res.data.token)
  return res.data.user
}

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const res = await api.get<User>('/auth/me')
    return res.data
  } catch {
    return null
  }
}

export const logoutUser = () => {
  localStorage.removeItem(TOKEN_KEY)
}

export const hasValidToken = (): boolean => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp: number }
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(TOKEN_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}
