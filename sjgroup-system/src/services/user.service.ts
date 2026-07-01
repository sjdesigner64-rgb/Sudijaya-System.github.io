import { api } from '@/config/api'
import type { UserRole } from '@/types'

interface CreateUserParams {
  name: string
  email: string
  password: string
  role: UserRole
}

export const createUserAccount = async (params: CreateUserParams) => {
  const res = await api.post('/users', params)
  return res.data.id as string
}

export const deleteUserAccount = async (userId: string) => {
  await api.delete(`/users/${userId}`)
}

export const updateUserProfile = async (
  userId: string,
  data: Partial<{ name: string; email: string; role: UserRole; isActive: boolean }>
) => {
  await api.put(`/users/${userId}`, data)
}

export const resetUserPassword = async (userId: string, password: string) => {
  await api.put(`/users/${userId}`, { password })
}
