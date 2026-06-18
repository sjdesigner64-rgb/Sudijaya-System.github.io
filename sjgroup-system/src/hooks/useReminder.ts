import { useEffect, useCallback } from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuthStore } from '@/store/authStore'

const REMINDER_HOURS = [9, 13, 17]

export const useReminder = () => {
  const { user } = useAuthStore()
  const { setShowReminder } = useNotificationStore()

  const checkReminderTime = useCallback(() => {
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()
    if (REMINDER_HOURS.includes(hour) && minute === 0) {
      setShowReminder(true)
    }
  }, [setShowReminder])

  // trigger reminder on login
  useEffect(() => {
    if (user) {
      setShowReminder(true)
    }
  }, [user, setShowReminder])

  // trigger reminder at scheduled hours
  useEffect(() => {
    if (!user) return
    const interval = setInterval(checkReminderTime, 60_000)
    return () => clearInterval(interval)
  }, [user, checkReminderTime])
}
