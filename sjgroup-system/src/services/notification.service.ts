import { createDoc } from './firestore.service'
import type { NotificationType } from '@/types'

interface CreateNotificationParams {
  recipientId: string
  type: NotificationType
  title: string
  message: string
  relatedId: string
  relatedCollection: string
}

export const createNotification = async (params: CreateNotificationParams) => {
  return createDoc('notifications', {
    ...params,
    isRead: false,
  })
}

export const notifyDpReceived = async (
  fabrikasiUserIds: string[],
  projectName: string,
  projectId: string
) => {
  const promises = fabrikasiUserIds.map((uid) =>
    createNotification({
      recipientId: uid,
      type: 'dp_received',
      title: 'DP Masuk',
      message: `Down Payment telah masuk untuk project ${projectName}. Segera mulai proses produksi.`,
      relatedId: projectId,
      relatedCollection: 'projects',
    })
  )
  await Promise.all(promises)
}

export const notifyQuotationReady = async (
  salesUserId: string,
  projectName: string,
  quotationId: string
) => {
  return createNotification({
    recipientId: salesUserId,
    type: 'quotation',
    title: 'Quotation Siap',
    message: `Quotation untuk project ${projectName} telah selesai dibuat. Silakan download PDF penawaran.`,
    relatedId: quotationId,
    relatedCollection: 'quotations',
  })
}

export const notifyDrawingRequest = async (
  fabrikasiUserIds: string[],
  projectName: string,
  requestId: string
) => {
  const promises = fabrikasiUserIds.map((uid) =>
    createNotification({
      recipientId: uid,
      type: 'drawing_request',
      title: 'Request Gambar Masuk',
      message: `Sales mengirim request gambar untuk project ${projectName}.`,
      relatedId: requestId,
      relatedCollection: 'requests_drawing',
    })
  )
  await Promise.all(promises)
}
