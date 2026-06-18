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
  data: Partial<{ name: string; role: UserRole; isActive: boolean }>
) => {
  await updateDocument('users', uid, data)
}
