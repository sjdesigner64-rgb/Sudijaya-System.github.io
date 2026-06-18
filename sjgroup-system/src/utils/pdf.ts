import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Quotation, Invoice } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const fmt = (date: Date) => format(date, 'dd MMMM yyyy', { locale: localeId })
const currency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n)

export const generateQuotationPDF = (quotation: Quotation, customerName: string) => {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.text('SUDIJAYA GROUP', 14, 20)
  doc.setFontSize(12)
  doc.text('Penawaran Harga', 14, 28)

  doc.setFontSize(10)
  doc.text(`No. Quotation: ${quotation.id}`, 14, 40)
  doc.text(`Customer: ${customerName}`, 14, 47)
  doc.text(`Tanggal: ${fmt(new Date())}`, 14, 54)
  doc.text(`Deadline: ${fmt(quotation.deadline)}`, 14, 61)

  autoTable(doc, {
    startY: 70,
    head: [['No', 'Deskripsi', 'Qty', 'Satuan', 'Harga Satuan', 'Total']],
    body: quotation.items.map((item, i) => [
      i + 1,
      item.description,
      item.qty,
      item.unit,
      currency(item.price),
      currency(item.qty * item.price),
    ]),
    foot: [['', '', '', '', 'TOTAL', currency(quotation.totalAmount)]],
  })

  doc.save(`quotation-${quotation.id}.pdf`)
}

export const generateInvoicePDF = (invoice: Invoice, customerName: string) => {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.text('SUDIJAYA GROUP', 14, 20)
  doc.setFontSize(12)
  doc.text('INVOICE', 14, 28)

  doc.setFontSize(10)
  doc.text(`No. Invoice: ${invoice.invoiceNumber}`, 14, 40)
  doc.text(`Customer: ${customerName}`, 14, 47)
  doc.text(`Tanggal: ${fmt(invoice.createdAt)}`, 14, 54)
  doc.text(`Total: ${currency(invoice.amount)}`, 14, 61)

  doc.save(`invoice-${invoice.invoiceNumber}.pdf`)
}
