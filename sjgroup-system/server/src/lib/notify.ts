import { prisma } from './prisma'
import { emitChange } from './socketBus'

interface NotifyParams {
  recipientId: string
  type: string
  title: string
  message: string
  relatedId: string
  relatedCollection: string
}

export const notifyUser = async (params: NotifyParams) => {
  await prisma.notification.create({ data: { ...params, isRead: false } })
  emitChange('notifications')
}

export const notifyUsers = async (recipientIds: string[], params: Omit<NotifyParams, 'recipientId'>) => {
  await Promise.all(recipientIds.map((recipientId) => notifyUser({ ...params, recipientId })))
}

export const getActiveUsersByRole = async (roles: string[]) => {
  return prisma.user.findMany({ where: { role: { in: roles }, isActive: true } })
}
