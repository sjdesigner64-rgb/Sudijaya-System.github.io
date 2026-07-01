import { api } from '@/config/api'
import { updateDocument } from './firestore.service'
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

export const deleteUserAccount = async (uid: string) => {
  await api.delete(`/users/${uid}`)
}

export const updateUserProfile = async (
  uid: string,
  data: Partial<{ name: string; email: string; role: UserRole; isActive: boolean }>
) => {
  if ('email' in data) {
    await api.put(`/users/${uid}`, data)
  } else {
    await updateDocument('users', uid, data)
  }
}

export const resetUserPassword = async (uid: string, password: string) => {
  await api.put(`/users/${uid}`, { password })
}
