import axios from 'axios'
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
    const res = await api.get<User>('/auth/me', { timeout: 8000 })
    return res.data
  } catch (err) {
    // Hanya return null (trigger logout) jika server tegas menolak token dengan 401
    // Error jaringan / server restart / timeout: lempar error agar tidak auto-logout
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      return null
    }
    // Network error, timeout, atau server 5xx — jangan logout, lempar ke caller
    throw err
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
    localStorage.removeItem(TOKEN_KEY)
    return false
  }
}
