import { api } from '@/config/api'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const uploadFile = async (path: string, file: File): Promise<string> => {
  if (file.size > MAX_FILE_SIZE) throw new Error('Ukuran file maksimal 10MB')

  const formData = new FormData()
  formData.append('file', file)

  const res = await api.post('/upload', formData, {
    params: { path },
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.url as string
}

export const deleteFile = async (path: string) => {
  await api.delete('/upload', { data: { path } })
}

export const buildPath = {
  invoice: (invoiceId: string, fileName: string) =>
    `invoices/${invoiceId}/${fileName}`,
  quotation: (quotationId: string, fileName: string) =>
    `quotations/${quotationId}/${fileName}`,
  drawing: (requestId: string, fileName: string) =>
    `drawings/${requestId}/${fileName}`,
  bom: (bomId: string, fileName: string) =>
    `bom/${bomId}/${fileName}`,
  content: (contentId: string, fileName: string) =>
    `content/${contentId}/${fileName}`,
  ktp: (customerId: string, fileName: string) =>
    `customers/${customerId}/ktp/${fileName}`,
  mediaAsset: (assetId: string, fileName: string) =>
    `media-assets/${assetId}/${fileName}`,
  contentData: (contentDataId: string, fileName: string) =>
    `content-data/${contentDataId}/${fileName}`,
}
