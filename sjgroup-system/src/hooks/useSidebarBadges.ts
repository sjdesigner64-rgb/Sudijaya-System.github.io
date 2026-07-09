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

    // Request BOM — pending (fabrikasi: pending_fabrikasi; admin: semua pending; sales: milik sendiri yg pending)
    if (['super_admin', 'admin', 'fabrikasi', 'sales'].includes(role)) {
      unsubs.push(
        subscribeToCollection('requests_bom', [], (docs) => {
          const n = docs.filter((d) => {
            if (role === 'admin' || role === 'super_admin')
              return d.status === 'pending_fabrikasi' || d.status === 'pending_admin'
            if (role === 'sales')
              return (d.requestedBy === userId) && (d.status === 'pending_fabrikasi' || d.status === 'pending_admin')
            return d.status === 'pending_fabrikasi'
          }).length
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

    // Quotation — request dari sales (isRequest=true & status='diproses') yang belum diproses admin
    if (['super_admin', 'admin', 'sales'].includes(role)) {
      unsubs.push(
        subscribeToCollection('quotations', [], (docs) => {
          const n = docs.filter((d) => {
            if (!d.isRequest || d.status !== 'diproses') return false
            // sales: hanya request milik sendiri; admin: semua request
            if (role === 'sales') return d.requestedBy === userId || d.createdBy === userId
            return true
          }).length
          set('/quotation', n)
        })
      )
    }

    // Invoice — request dari sales (isRequest=true & belum ada invoiceNumber)
    if (['super_admin', 'admin', 'sales'].includes(role)) {
      unsubs.push(
        subscribeToCollection('invoices', [], (docs) => {
          const n = docs.filter((d) => {
            if (!d.isRequest || d.invoiceNumber) return false
            if (role === 'sales') return d.createdBy === userId || d.picSales === userId
            return true
          }).length
          set('/invoice', n)
        })
      )
    }

    // Payment Tracking — project belum ada rencana payment ATAU ada termin pending; lead belum lunas
    if (['super_admin', 'admin'].includes(role)) {
      let projectCount = 0
      let leadCount = 0
      const updatePayment = () => set('/payment', projectCount + leadCount)

      unsubs.push(
        subscribeToCollection('projects', [], (docs) => {
          projectCount = docs.filter((d) => {
            const payments = d.payments as { status: string }[] | undefined
            if (!Array.isArray(payments) || payments.length === 0) return true
            return payments.some((p) => p.status === 'pending')
          }).length
          updatePayment()
        })
      )

      unsubs.push(
        subscribeToCollection('leads', [], (docs) => {
          leadCount = docs.filter((d) => {
            const status = (d.dpPelunasan as string | undefined) ?? 'belum_dp'
            return status !== 'sudah_lunas'
          }).length
          updatePayment()
        })
      )
    }

    return () => unsubs.forEach((u) => u())
  }, [user])

  return { ...counts, '/inbox': unreadCount }
}
