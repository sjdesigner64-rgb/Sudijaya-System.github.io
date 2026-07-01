import { useEffect, useState } from 'react'
import { Plus, Download, Upload, Pencil, Trash2, Loader2, Search, SendHorizonal, Clock, FileText, Banknote } from 'lucide-react'
import type { Invoice, User } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { generateInvoicePDF } from '@/utils/pdf'
import { notifyInvoiceReady, notifyInvoiceRequested } from '@/services/notification.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const currency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n)

const err = (invalid: boolean) =>
  invalid ? 'border-red-400 dark:border-red-600' : 'border-input'

// ─── Form Request (Sales) ─────────────────────────────────────────────────────
interface InvoiceRequestFormProps {
  adminUsers: User[]
  onClose: () => void
}

function InvoiceRequestForm({ adminUsers, onClose }: InvoiceRequestFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [amount, setAmount] = useState('')
  const [picAdmin, setPicAdmin] = useState(adminUsers[0]?.id ?? '')
  const [catatan, setCatatan] = useState('')

  const handleSave = async () => {
    setSubmitted(true)
    if (!customerName.trim() || !picAdmin || !user) return
    setSaving(true)
    try {
      const invoiceId = await createDoc('invoices', {
        quotationId: '',
        projectId: '',
        customerId: '',
        invoiceNumber: '',
        createdBy: user.id,
        customerName: customerName.trim(),
        projectName: projectName.trim(),
        amount: Number(amount) || 0,
        picSales: user.id,
        picAdmin,
        isRequest: true,
        catatan,
      })
      await notifyInvoiceRequested(picAdmin, user.name, customerName.trim(), invoiceId)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <h3 className="font-semibold">Request Invoice ke Admin</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Admin yang dipilih akan mendapat notifikasi untuk membuat invoice</p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Nama Customer <span className="text-red-500">*</span></label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`w-full px-3 py-2 border ${err(submitted && !customerName.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
                placeholder="Nama customer"
              />
              {submitted && !customerName.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Nama Project</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nama project (opsional)"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">PIC Admin yang Ditugaskan <span className="text-red-500">*</span></label>
            <select
              value={picAdmin}
              onChange={(e) => setPicAdmin(e.target.value)}
              className={`w-full px-3 py-2 border ${err(submitted && !picAdmin)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
            >
              <option value="">— Pilih Admin —</option>
              {adminUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {submitted && !picAdmin && <p className="text-xs text-red-500 mt-0.5">Wajib pilih admin</p>}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Estimasi Amount (Rp)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Opsional"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Catatan untuk Admin</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Keterangan tambahan, nomor PO, atau instruksi khusus..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizonal className="h-3.5 w-3.5" />}
            Kirim Request
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Form Invoice (Admin) ─────────────────────────────────────────────────────
interface InvoiceFormProps {
  salesUsers: User[]
  adminUsers: User[]
  initial?: Invoice
  onClose: () => void
}

function InvoiceForm({ salesUsers, adminUsers, initial, onClose }: InvoiceFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? '')
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '')
  const [projectName, setProjectName] = useState(initial?.projectName ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount || '') : '')
  const [picSales, setPicSales] = useState(initial?.picSales ?? salesUsers[0]?.id ?? '')
  const [picAdmin, setPicAdmin] = useState(initial?.picAdmin ?? user?.id ?? '')
  const [file, setFile] = useState<File | null>(null)

  const handleSave = async () => {
    setSubmitted(true)
    if (!invoiceNumber.trim() || !customerName.trim() || !amount || !user) return
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
          picAdmin,
          isRequest: false,
        }
        if (file) {
          const url = await uploadFile(buildPath.invoice(initial.id, file.name), file)
          updateData.uploadedFileUrl = url
        }
        await updateDocument('invoices', initial.id, updateData)
        // Notifikasi sales jika baru selesai (dari request)
        if (initial.isRequest && picSales) {
          await notifyInvoiceReady(picSales, invoiceNumber, initial.id)
        }
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
          picAdmin,
          isRequest: false,
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
      <div className="bg-card border border-border rounded-xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <h3 className="font-semibold">{initial ? 'Edit Invoice' : 'Buat Invoice'}</h3>
          {initial?.isRequest && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Request dari Sales — lengkapi nomor invoice, amount, dan upload file
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">

          {/* Catatan dari sales */}
          {initial?.catatan && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-0.5">Catatan dari Sales:</p>
              <p className="text-sm text-amber-800 dark:text-amber-200">{initial.catatan}</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">No. Invoice <span className="text-red-500">*</span></label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className={`w-full px-3 py-2 border ${err(submitted && !invoiceNumber.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
              placeholder="INV-2026-XXX"
            />
            {submitted && !invoiceNumber.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Nama Customer <span className="text-red-500">*</span></label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`w-full px-3 py-2 border ${err(submitted && !customerName.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
                placeholder="Nama customer"
              />
              {submitted && !customerName.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Nama Project</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Opsional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">PIC Sales</label>
              <select value={picSales} onChange={(e) => setPicSales(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">PIC Admin</label>
              <select value={picAdmin} onChange={(e) => setPicAdmin(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {adminUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Total Amount (Rp) <span className="text-red-500">*</span></label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`w-full px-3 py-2 border ${err(submitted && !amount)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
            />
            {submitted && !amount && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Upload File Invoice (PDF)</label>
            <label className="flex items-center justify-center w-full h-12 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors text-sm text-muted-foreground gap-2">
              <Upload className="h-4 w-4" />
              {file ? file.name : (initial?.uploadedFileUrl ? 'Ganti file PDF' : 'Pilih file PDF')}
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex gap-2">
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export function InvoicePage() {
  const { user } = useAuthStore()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [adminUsers, setAdminUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
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
    const unsubA = subscribeToCollection('users', [where('role', '==', 'admin')], (docs) => {
      setAdminUsers(docs as unknown as User[])
    })
    return () => { unsubI(); unsubS(); unsubA() }
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

  const allUsers = [...salesUsers, ...adminUsers]
  const userName = (id?: string) => allUsers.find((u) => u.id === id)?.name ?? '-'

  // Visibility filter — sama pola dengan QuotationPage
  const visible = invoices.filter((inv) => {
    if (user?.role === 'super_admin') return true
    if (isSales) return inv.picSales === user?.id
    return !inv.picAdmin || inv.picAdmin === user?.id
  })

  const pendingRequests = visible.filter((inv) => inv.isRequest && !inv.invoiceNumber).length

  const filtered = visible.filter((inv) => {
    const q = search.toLowerCase()
    return (
      (inv.invoiceNumber ?? '').toLowerCase().includes(q) ||
      (inv.customerName ?? '').toLowerCase().includes(q) ||
      (inv.projectName ?? '').toLowerCase().includes(q)
    )
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // KPI
  const totalAmount = visible.reduce((s, inv) => s + (inv.amount ?? 0), 0)
  const withFile = visible.filter((inv) => inv.uploadedFileUrl).length
  const requestCount = visible.filter((inv) => inv.isRequest && !inv.invoiceNumber).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Invoice</h1>
          <p className="text-sm text-muted-foreground">Buat dan kelola invoice customer</p>
        </div>
        <div className="flex gap-2">
          {isSales && (
            <button
              onClick={() => setShowRequestForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            >
              <SendHorizonal className="h-4 w-4" />
              Request Invoice
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { setEditTarget(null); setShowForm(true) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Buat Invoice
            </button>
          )}
        </div>
      </div>

      {/* Banner pending request untuk admin */}
      {isAdmin && pendingRequests > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl text-sm">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-amber-800 dark:text-amber-200">
            Ada <strong>{pendingRequests} request invoice</strong> dari Sales yang menunggu diproses.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Invoice', value: String(visible.length), icon: <FileText className="h-5 w-5" />, color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400' },
          { label: 'Request Pending', value: String(requestCount), icon: <Clock className="h-5 w-5" />, color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' },
          { label: 'Ada File PDF', value: String(withFile), icon: <Upload className="h-5 w-5" />, color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' },
          {
            label: 'Total Amount',
            value: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(totalAmount),
            icon: <Banknote className="h-5 w-5" />,
            color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
          },
        ].map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className={cn('p-2 rounded-lg', c.color)}>{c.icon}</span>
              <span className="text-2xl font-bold">{c.value}</span>
            </div>
            <p className="text-sm font-medium">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Cari no. invoice, project, atau customer..."
          className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">No. Invoice</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC Sales</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC Admin</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Tanggal</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">File</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((inv) => (
                <tr key={inv.id} className={cn('hover:bg-muted/20 transition-colors', inv.isRequest && !inv.invoiceNumber && 'bg-amber-50/40 dark:bg-amber-950/20')}>
                  <td className="p-3 font-medium whitespace-nowrap">
                    {inv.invoiceNumber || (
                      <span className="text-muted-foreground italic text-xs">Belum dibuat</span>
                    )}
                    {inv.isRequest && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-[10px] rounded font-medium">
                        Request
                      </span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="font-medium text-sm">{inv.customerName || '-'}</div>
                    {inv.projectName && <div className="text-xs text-muted-foreground">{inv.projectName}</div>}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{userName(inv.picSales)}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{userName(inv.picAdmin)}</td>
                  <td className="p-3 font-semibold whitespace-nowrap">
                    {inv.amount > 0 ? currency(inv.amount) : <span className="text-muted-foreground font-normal text-xs">—</span>}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                    {format(inv.createdAt, 'd MMM yyyy', { locale: localeId })}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {inv.uploadedFileUrl ? (
                      <a href={inv.uploadedFileUrl} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline">Ada file</a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Belum ada</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {inv.invoiceNumber && (
                        <button
                          onClick={() => generateInvoicePDF(inv, inv.customerName ?? '-')}
                          className="flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                        >
                          <Download className="h-3 w-3" /> PDF
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button onClick={() => setEditTarget(inv)} className="p-1 text-muted-foreground hover:text-foreground rounded" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(inv)} className="p-1 text-muted-foreground hover:text-destructive rounded" title="Hapus">
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
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">Belum ada invoice</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {/* Form request (Sales) */}
      {showRequestForm && (
        <InvoiceRequestForm
          adminUsers={adminUsers}
          onClose={() => setShowRequestForm(false)}
        />
      )}

      {/* Form buat/edit (Admin) */}
      {(showForm || editTarget) && (
        <InvoiceForm
          salesUsers={salesUsers}
          adminUsers={adminUsers}
          initial={editTarget ?? undefined}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus invoice "${deleteTarget.invoiceNumber || 'request ini'}"? Tindakan ini tidak dapat dibatalkan.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
