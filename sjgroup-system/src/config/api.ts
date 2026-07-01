import axios from 'axios'
import { io } from 'socket.io-client'

export const TOKEN_KEY = 'sjgroup_token'

// Jika VITE_API_URL kosong (production same-origin), gunakan path relatif
const apiBase = import.meta.env.VITE_API_URL || ''

export const api = axios.create({ baseURL: `${apiBase}/api` })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Jika apiBase kosong, socket.io otomatis connect ke origin yang sama
export const socket = io(apiBase || undefined, { autoConnect: true })
