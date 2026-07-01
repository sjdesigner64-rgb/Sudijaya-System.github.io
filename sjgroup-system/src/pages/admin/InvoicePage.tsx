import { useEffect, useState } from 'react'
import { Plus, Download, Upload, Pencil, Trash2, Loader2, Search } from 'lucide-react'
import type { Invoice, User } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { generateInvoicePDF } from '@/utils/pdf'
import { notifyInvoiceReady } from '@/services/notification.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const currency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n)

interface InvoiceFormProps {
  projects: unknown[]
  salesUsers: User[]
  initial?: Invoice
  onClose: () => void
}

const err = (invalid: boolean) =>
  invalid ? 'border-red-400 dark:border-red-600' : 'border-input'

function InvoiceForm({ projects: _projects, salesUsers, initial, onClose }: InvoiceFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? '')
  const [projectName, setProjectName] = useState(initial?.projectName ?? '')
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [picSales, setPicSales] = useState(initial?.picSales ?? salesUsers[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)

  const handleSave = async () => {
    setSubmitted(true)
    if (!invoiceNumber.trim() || !amount || !customerName.trim() || !user) return
    setSaving(true)
    try {
      if (initial) {
        const updateData: Record<string, unknown> = {
          invoiceNumber,
          projectId: '',
          customerId: '',
          customerName: customerName.trim(),
          projectName: projectName.trim(),
          amount: Number(amount),
          picSales,
        }
        if (file) {
          const url = await uploadFile(buildPath.invoice(initial.id, file.name), file)
          updateData.uploadedFileUrl = url
        }
        await updateDocument('invoices', initial.id, updateData)
      } else {
        const invoiceId = await createDoc('invoices', {
          quotationId: '',
          projectId: '',
          customerId: '',
          customerName: customerName.trim(),
          projectName: projectName.trim(),
          invoiceNumber,
          createdBy: user.id,
          amount: Number(amount),
          picSales,
        })
        if (file) {
          const url = await uploadFile(buildPath.invoice(invoiceId, file.name), file)
          await updateDocument('invoices', invoiceId, { uploadedFileUrl: url })
        }
        if (picSales) {
          await notifyInvoiceReady(picSales, invoiceNumber, invoiceId)
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Invoice' : 'Buat Invoice'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">No. Invoice <span className="text-red-500">*</span></label>
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={`w-full px-3 py-2 border ${err(submitted && !invoiceNumber.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`} placeholder="INV-2026-XXX" />
            {submitted && !invoiceNumber.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Nama Customer <span className="text-red-500">*</span></label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              className={`w-full px-3 py-2 border ${err(submitted && !customerName.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
              placeholder="Nama customer" />
            {submitted && !customerName.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Nama Project</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Nama project (opsional)" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">PIC Sales <span className="text-red-500">*</span></label>
            <select value={picSales} onChange={(e) => setPicSales(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Total Amount <span className="text-red-500">*</span></label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={`w-full px-3 py-2 border ${err(submitted && !amount)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`} />
            {submitted && !amount && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Upload File Invoice (PDF)</label>
            <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors text-sm text-muted-foreground gap-2">
              <Upload className="h-4 w-4" />
              {file ? file.name : (initial?.uploadedFileUrl ? 'Ganti file PDF' : 'Pilih file PDF')}
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function InvoicePage() {
  const { user } = useAuthStore()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Invoice | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const isSales = user?.role === 'sales'

  useEffect(() => {
    const unsubI = subscribeToCollection('invoices', [], (docs) => {
      setInvoices(
        docs.map((d) => ({
          ...d,
          createdAt: toDate(d.createdAt as never) ?? new Date(),
        })) as unknown as Invoice[]
      )
    })
    const unsubS = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => {
      setSalesUsers(docs as unknown as User[])
    })
    return () => { unsubI(); unsubS() }
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('invoices', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const salesName = (id?: string) => salesUsers.find((u) => u.id === id)?.name ?? '-'

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase()
    const matchSearch =
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.customerName ?? '').toLowerCase().includes(q) ||
      (inv.projectName ?? '').toLowerCase().includes(q)
    const matchSales = !isSales || inv.picSales === user?.id
    return matchSearch && matchSales
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Invoice</h1>
          <p className="text-sm text-muted-foreground">Buat dan kelola invoice customer</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Buat Invoice
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Cari no. invoice, project, atau customer..."
          className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">No. Invoice</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC Sales</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Tanggal</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">File</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/20">
                  <td className="p-3 font-medium whitespace-nowrap">{inv.invoiceNumber}</td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="font-medium text-sm">{inv.customerName || '-'}</div>
                    {inv.projectName && <div className="text-xs text-muted-foreground">{inv.projectName}</div>}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{salesName(inv.picSales)}</td>
                  <td className="p-3 font-semibold whitespace-nowrap">{currency(inv.amount)}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                    {format(inv.createdAt, 'd MMM yyyy', { locale: localeId })}
                  </td>
                  <td className="p-3">
                    {inv.uploadedFileUrl ? (
                      <a href={inv.uploadedFileUrl} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline">Ada file</a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Belum ada file</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => generateInvoicePDF(inv, inv.customerName ?? '-')}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" /> PDF
                      </button>
                      {isAdmin && (
                        <>
                          <button onClick={() => setEditTarget(inv)} className="p-1 text-muted-foreground hover:text-foreground rounded">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(inv)} className="p-1 text-muted-foreground hover:text-destructive rounded">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">Belum ada invoice</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && <InvoiceForm projects={[]} salesUsers={salesUsers} onClose={() => setShowForm(false)} />}
      {editTarget && (
        <InvoiceForm projects={[]} salesUsers={salesUsers} initial={editTarget} onClose={() => setEditTarget(null)} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus invoice ${deleteTarget.invoiceNumber}? Tindakan ini tidak dapat dibatalkan.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
