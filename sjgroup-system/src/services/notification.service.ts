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

export const notifyQuotationRequested = async (
  adminId: string,
  salesName: string,
  customerName: string,
  quotationId: string
) => {
  return createNotification({
    recipientId: adminId,
    type: 'quotation',
    title: 'Request Quotation Masuk',
    message: `${salesName} mengirim request quotation untuk customer "${customerName}". Segera proses penawaran harga.`,
    relatedId: quotationId,
    relatedCollection: 'quotations',
  })
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

export const notifyInvoiceRequested = async (
  adminId: string,
  salesName: string,
  customerName: string,
  invoiceId: string
) => {
  return createNotification({
    recipientId: adminId,
    type: 'invoice',
    title: 'Request Invoice Masuk',
    message: `${salesName} mengirim request invoice untuk customer "${customerName}". Segera buat dan upload invoice.`,
    relatedId: invoiceId,
    relatedCollection: 'invoices',
  })
}

export const notifyInvoiceReady = async (
  picSalesId: string,
  invoiceNumber: string,
  invoiceId: string
) => {
  return createNotification({
    recipientId: picSalesId,
    type: 'invoice',
    title: 'Invoice Baru',
    message: `Invoice ${invoiceNumber} telah dibuat. Silakan periksa detail invoice.`,
    relatedId: invoiceId,
    relatedCollection: 'invoices',
  })
}

export const notifyLeadAssigned = async (
  salesId: string,
  customerName: string,
  leadId: string
) => {
  return createNotification({
    recipientId: salesId,
    type: 'task',
    title: 'Project Satuan Baru',
    message: `Project satuan dari customer "${customerName}" telah ditugaskan kepada Anda.`,
    relatedId: leadId,
    relatedCollection: 'leads',
  })
}

export const notifyProjectSalesCreated = async (
  salesPicId: string,
  projectName: string,
  projectId: string
) => {
  return createNotification({
    recipientId: salesPicId,
    type: 'task',
    title: 'Project Sales Baru',
    message: `Project "${projectName}" telah dibuat dan ditugaskan kepada Anda.`,
    relatedId: projectId,
    relatedCollection: 'projects',
  })
}

export const notifyShipmentReady = async (
  salesId: string,
  adminUserIds: string[],
  customerName: string,
  productName: string,
  leadId: string
) => {
  const msg = `Project Satuan "${productName}" milik ${customerName} telah lunas dan masuk ke tahap pengiriman. Segera lengkapi data pengiriman.`
  const recipients = [...new Set([salesId, ...adminUserIds])]
  const promises = recipients.map((uid) =>
    createNotification({
      recipientId: uid,
      type: 'reminder',
      title: 'Masuk Tahap Pengiriman',
      message: msg,
      relatedId: leadId,
      relatedCollection: 'leads',
    })
  )
  await Promise.all(promises)
}

export const notifyBomRequest = async (
  fabrikasiUserIds: string[],
  projectName: string,
  bomId: string
) => {
  const promises = fabrikasiUserIds.map((uid) =>
    createNotification({
      recipientId: uid,
      type: 'bom_request',
      title: 'Request BOM Masuk',
      message: `Sales mengirim request BOM untuk project "${projectName}". Segera proses dan upload hasil BOM.`,
      relatedId: bomId,
      relatedCollection: 'requests_bom',
    })
  )
  await Promise.all(promises)
}

export const notifyBomResultUploaded = async (
  adminId: string,
  projectName: string,
  bomId: string
) => {
  return createNotification({
    recipientId: adminId,
    type: 'bom_request',
    title: 'Hasil BOM Siap Diunduh',
    message: `Fabrikasi telah mengupload hasil BOM untuk project "${projectName}". Silakan download dan konfirmasi selesai.`,
    relatedId: bomId,
    relatedCollection: 'requests_bom',
  })
}

export const notifyBomDone = async (
  salesId: string,
  projectName: string,
  bomId: string
) => {
  return createNotification({
    recipientId: salesId,
    type: 'bom_request',
    title: 'BOM Selesai Diproses',
    message: `Request BOM untuk project "${projectName}" telah selesai diproses oleh admin.`,
    relatedId: bomId,
    relatedCollection: 'requests_bom',
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

export const notifyShipmentSalesReady = async (
  salesId: string,
  adminUserIds: string[],
  projectName: string,
  projectId: string
) => {
  const msg = `Project Sales "${projectName}" telah lunas dan masuk ke tahap pengiriman. Segera lengkapi data pengiriman.`
  const recipients = [...new Set([salesId, ...adminUserIds])]
  const promises = recipients.map((uid) =>
    createNotification({
      recipientId: uid,
      type: 'reminder',
      title: 'Masuk Tahap Pengiriman',
      message: msg,
      relatedId: projectId,
      relatedCollection: 'projects',
    })
  )
  await Promise.all(promises)
}

export const notifyMeetingFabrikasi = async (
  salesId: string,
  fabrikasiIds: string[],
  projectName: string,
  projectId: string
) => {
  const msg = `Project "${projectName}" siap masuk tahap Meeting Fabrikasi. DP dan gambar sudah selesai.`
  const recipients = [...new Set([salesId, ...fabrikasiIds])]
  const promises = recipients.map((uid) =>
    createNotification({
      recipientId: uid,
      type: 'reminder',
      title: 'Masuk Tahap Meeting Fabrikasi',
      message: msg,
      relatedId: projectId,
      relatedCollection: 'projects',
    })
  )
  await Promise.all(promises)
}

export const notifyQcFatDone = async (
  adminIds: string[],
  mediaIds: string[],
  projectName: string,
  projectId: string
) => {
  const msg = `Tahap QC & FAT project "${projectName}" telah selesai. Segera siapkan proses pelunasan.`
  const recipients = [...new Set([...adminIds, ...mediaIds])]
  const promises = recipients.map((uid) =>
    createNotification({
      recipientId: uid,
      type: 'reminder',
      title: 'QC & FAT Selesai',
      message: msg,
      relatedId: projectId,
      relatedCollection: 'projects',
    })
  )
  await Promise.all(promises)
}

export const notifyPengirimSalesSelesai = async (
  salesId: string,
  adminIds: string[],
  projectName: string,
  projectId: string
) => {
  const msg = `Pengiriman project "${projectName}" telah selesai. Proyek akan dilanjutkan ke tahap instalasi.`
  const recipients = [...new Set([salesId, ...adminIds])]
  const promises = recipients.map((uid) =>
    createNotification({
      recipientId: uid,
      type: 'reminder',
      title: 'Pengiriman Selesai — Masuk Instalasi',
      message: msg,
      relatedId: projectId,
      relatedCollection: 'projects',
    })
  )
  await Promise.all(promises)
}
