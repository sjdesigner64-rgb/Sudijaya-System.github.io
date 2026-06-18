import { useEffect } from 'react'
import { where, orderBy, subscribeToCollection } from '@/services/firestore.service'
import { toDate } from '@/utils/firestore'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuthStore } from '@/store/authStore'
import type { Notification } from '@/types'

export const useNotifications = () => {
  const { user } = useAuthStore()
  const { setNotifications, markAsRead, markAllAsRead } = useNotificationStore()

  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToCollection(
      'notifications',
      [where('recipientId', '==', user.id), orderBy('createdAt', 'desc')],
      (data) => {
        const notifs = data.map((d) => ({
          ...d,
          createdAt: toDate(d.createdAt as never) ?? new Date(),
        })) as unknown as Notification[]
        setNotifications(notifs)
      }
    )
    return unsubscribe
  }, [user, setNotifications])

  return { markAsRead, markAllAsRead }
}
