import axios from 'axios'
import { io } from 'socket.io-client'

export const TOKEN_KEY = 'sjgroup_token'

export const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api` })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const socket = io(import.meta.env.VITE_API_URL, { autoConnect: true })
