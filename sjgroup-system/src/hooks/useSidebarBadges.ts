import { useEffect, useState } from 'react'
import { subscribeToCollection, where } from '@/services/firestore.service'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'

export type BadgeCounts = Record<string, number>

export const useSidebarBadges = (): BadgeCounts => {
  const { user } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const [counts, setCounts] = useState<BadgeCounts>({})

  useEffect(() => {
    if (!user) return
    const { role, id: userId } = user
    const unsubs: (() => void)[] = []

    const set = (route: string, count: number) =>
      setCounts((prev) => ({ ...prev, [route]: count }))

    // Request Gambar — pending (fabrikasi: hanya yang di-assign ke mereka)
    if (['super_admin', 'admin', 'sales', 'fabrikasi'].includes(role)) {
      unsubs.push(
        subscribeToCollection('requests_drawing', [], (docs) => {
          const n = docs.filter((d) => {
            if (d.status !== 'pending') return false
            if (role === 'fabrikasi') {
              return Array.isArray(d.assignedTo) && (d.assignedTo as string[]).includes(userId)
            }
            return true
          }).length
          set('/drawing-request', n)
        })
      )
    }

    // Request BOM — pending (fabrikasi & warehouse: pending_fabrikasi; admin: semua pending)
    if (['super_admin', 'admin', 'fabrikasi', 'warehouse'].includes(role)) {
      unsubs.push(
        subscribeToCollection('requests_bom', [], (docs) => {
          const n = docs.filter((d) =>
            role === 'admin' || role === 'super_admin'
              ? d.status === 'pending_fabrikasi' || d.status === 'pending_admin'
              : d.status === 'pending_fabrikasi'
          ).length
          set('/bom-request', n)
        })
      )
    }

    // Request Konten — status 'baru'
    if (['super_admin', 'sales', 'media'].includes(role)) {
      unsubs.push(
        subscribeToCollection('content_requests', [], (docs) => {
          set('/content', docs.filter((d) => d.status === 'baru').length)
        })
      )
    }

    // Pengiriman — status 'pending'
    if (['super_admin', 'admin', 'sales', 'fabrikasi'].includes(role)) {
      unsubs.push(
        subscribeToCollection('shipments', [], (docs) => {
          // backend sudah filter picPengiriman untuk fabrikasi
          set('/shipment', docs.filter((d) => !d.status || d.status === 'pending').length)
        })
      )
    }

    // Instalasi — status 'pending'
    if (['super_admin', 'admin', 'sales', 'fabrikasi'].includes(role)) {
      unsubs.push(
        subscribeToCollection('installations', [], (docs) => {
          set('/installation', docs.filter((d) => d.status === 'pending').length)
        })
      )
    }

    // After-Sales — ticketStatus 'baru'
    if (['super_admin', 'admin', 'sales'].includes(role)) {
      unsubs.push(
        subscribeToCollection('after_sales', [], (docs) => {
          set('/after-sales', docs.filter((d) => d.ticketStatus === 'baru').length)
        })
      )
    }

    // Daily Task — milik user & belum selesai
    if (['super_admin', 'admin', 'sales'].includes(role)) {
      unsubs.push(
        subscribeToCollection('tasks', [where('assignedTo', '==', userId)], (docs) => {
          set('/tasks', docs.filter((d) => d.status !== 'done').length)
        })
      )
    }

    return () => unsubs.forEach((u) => u())
  }, [user])

  return { ...counts, '/inbox': unreadCount }
}
