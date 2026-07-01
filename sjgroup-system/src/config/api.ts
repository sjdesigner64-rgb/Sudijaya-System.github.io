import axios from 'axios'
import { io } from 'socket.io-client'

export const TOKEN_KEY = 'sjgroup_token'

// Jika VITE_API_URL kosong (production same-origin), gunakan path relatif
const apiBase = import.meta.env.VITE_API_URL || ''

export const api = axios.create({ baseURL: `${apiBase}/api` })

// Request interceptor: tambahkan token ke setiap request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Callback logout global — di-register oleh useAuth saat mount (hindari circular import)
type LogoutHandler = () => void
let _onUnauthorized: LogoutHandler | null = null

export const registerUnauthorizedHandler = (handler: LogoutHandler) => {
  _onUnauthorized = handler
}

// Response interceptor: jika 401 di endpoint manapun → token sudah tidak valid → logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? ''
      // Hindari loop: jangan trigger logout untuk request login itu sendiri
      if (!url.includes('/auth/login')) {
        localStorage.removeItem(TOKEN_KEY)
        _onUnauthorized?.()
      }
    }
    return Promise.reject(error)
  }
)

// Jika apiBase kosong, socket.io otomatis connect ke origin yang sama
export const socket = io(apiBase || undefined, { autoConnect: true })
