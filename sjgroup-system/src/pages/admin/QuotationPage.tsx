import { useEffect, useState } from 'react'
import { Plus, Download, Trash2, Pencil, Upload, Loader2, Search, TrendingUp, RefreshCw, Clock, CheckCircle2, Banknote, SendHorizonal } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type { Quotation, QuotationStatus, User } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { generateQuotationPDF } from '@/utils/pdf'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { notifyQuotationReady, notifyQuotationRequested } from '@/services/notification.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const STATUS_COLORS: Record<QuotationStatus, string> = {
  diproses: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  pending: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  selesai: 'bg-green-100 dark:bg-green-900 text-green-700',
}

const currency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n)

const err = (invalid: boolean) =>
  invalid ? 'border-red-400 dark:border-red-600' : 'border-input'

// ─── Form Request (Sales) ─────────────────────────────────────────────────────
interface QuotationRequestFormProps {
  adminUsers: User[]
  salesUsers: User[]
  onClose: () => void
}

function QuotationRequestForm({ adminUsers, salesUsers, onClose }: QuotationRequestFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [machineName, setMachineName] = useState('')
  const [picAdmin, setPicAdmin] = useState(adminUsers[0]?.id ?? '')
  const [lokasi, setLokasi] = useState('')
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [deadline, setDeadline] = useState('')
  const [catatan, setCatatan] = useState('')

  const handleSave = async () => {
    setSubmitted(true)
    if (!customerName.trim() || !machineName.trim() || !picAdmin || !deadline || !user) return
    setSaving(true)
    try {
      const picSalesId = user.role === 'sales' ? user.id : (salesUsers.find((u) => u.id === user.id)?.id ?? salesUsers[0]?.id ?? '')
      const quotationId = await createDoc('quotations', {
        projectId: '',
        customerId: '',
        requestedBy: user.id,
        createdBy: user.id,
        picSales: picSalesId,
        picAdmin,
        isRequest: true,
        status: 'diproses' as QuotationStatus,
        deadline: new Date(deadline),
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        items: [],
        totalAmount: 0,
        customerName,
        machineName,
        lokasi,
        catatan,
      })
      await notifyQuotationRequested(picAdmin, user.name, customerName, quotationId)
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
          <h3 className="font-semibold">Request Quotation ke Admin</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Admin akan mendapat notifikasi dan mengerjakan penawaran harga</p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">

          {/* Customer + Mesin */}
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
              <label className="text-sm font-medium block mb-1">Mesin / Produk <span className="text-red-500">*</span></label>
              <input
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                className={`w-full px-3 py-2 border ${err(submitted && !machineName.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
                placeholder="Tipe mesin"
              />
              {submitted && !machineName.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
          </div>

          {/* PIC Admin */}
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

          {/* Tanggal + Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Tanggal Request</label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Deadline Dibutuhkan <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={`w-full px-3 py-2 border ${err(submitted && !deadline)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
              />
              {submitted && !deadline && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
          </div>

          {/* Lokasi */}
          <div>
            <label className="text-sm font-medium block mb-1">Lokasi Customer</label>
            <input
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Kota / alamat"
            />
          </div>

          {/* Catatan */}
          <div>
            <label className="text-sm font-medium block mb-1">Catatan untuk Admin</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Spesifikasi khusus, permintaan, atau keterangan tambahan..."
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

// ─── Form Quotation (Admin) ───────────────────────────────────────────────────
interface QuotationFormProps {
  salesUsers: User[]
  adminUsers: User[]
  initial?: Quotation
  onClose: () => void
}

function QuotationForm({ salesUsers, adminUsers, initial, onClose }: QuotationFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '')
  const [machineName, setMachineName] = useState(initial?.machineName ?? '')
  const [picSales, setPicSales] = useState(initial?.picSales ?? salesUsers[0]?.id ?? '')
  const [picAdmin, setPicAdmin] = useState(initial?.picAdmin ?? user?.id ?? '')
  const [lokasi, setLokasi] = useState(initial?.lokasi ?? '')
  const [tanggal, setTanggal] = useState(
    initial?.tanggal ? format(new Date(initial.tanggal), 'yyyy-MM-dd') : ''
  )
  const [deadline, setDeadline] = useState(
    initial?.deadline ? format(new Date(initial.deadline), 'yyyy-MM-dd') : ''
  )
  const [status, setStatus] = useState<QuotationStatus>(initial?.status ?? 'diproses')
  const [totalAmount, setTotalAmount] = useState(initial?.totalAmount ?? 0)
  const [file, setFile] = useState<File | null>(null)

  const handleSave = async () => {
    setSubmitted(true)
    if (!customerName.trim() || !machineName.trim() || !tanggal || !deadline || !user) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        projectId: '',
        customerId: '',
        requestedBy: picSales,
        createdBy: user.id,
        status,
        deadline: new Date(deadline),
        items: [],
        totalAmount,
        customerName,
        machineName,
        picSales,
        picAdmin,
        lokasi,
        tanggal: tanggal ? new Date(tanggal) : null,
        isRequest: false,
      }

      if (initial) {
        await updateDocument('quotations', initial.id, payload)
        if (file) {
          const url = await uploadFile(buildPath.quotation(initial.id, file.name), file)
          await updateDocument('quotations', initial.id, { fileUrl: url })
        }
        // Jika selesai dan ada picSales, notifikasi sales
        if (status === 'selesai' && picSales && initial.status !== 'selesai') {
          await notifyQuotationReady(picSales, customerName, initial.id)
        }
      } else {
        const quotationId = await createDoc('quotations', payload)
        if (file) {
          const url = await uploadFile(buildPath.quotation(quotationId, file.name), file)
          await updateDocument('quotations', quotationId, { fileUrl: url })
        }
        if (picSales) {
          await notifyQuotationReady(picSales, customerName, quotationId)
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <h3 className="font-semibold">{initial ? 'Edit Quotation' : 'Buat Quotation'}</h3>
          {initial?.isRequest && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Request dari Sales — lengkapi item penawaran dan ubah status ke Selesai
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">

          {/* Catatan dari sales (jika request) */}
          {initial?.catatan && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-0.5">Catatan dari Sales:</p>
              <p className="text-sm text-amber-800 dark:text-amber-200">{initial.catatan}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Nama Customer <span className="text-red-500">*</span></label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`w-full px-3 py-2 border ${err(submitted && !customerName.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
                placeholder="Nama customer / perusahaan"
              />
              {submitted && !customerName.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Mesin <span className="text-red-500">*</span></label>
              <input
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                className={`w-full px-3 py-2 border ${err(submitted && !machineName.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
                placeholder="Nama / tipe mesin"
              />
              {submitted && !machineName.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
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
            <div>
              <label className="text-sm font-medium block mb-1">Lokasi</label>
              <input
                value={lokasi}
                onChange={(e) => setLokasi(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Kota / alamat"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="diproses">Diproses</option>
                <option value="pending">Pending</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Tanggal <span className="text-red-500">*</span></label>
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={`w-full px-3 py-2 border ${err(submitted && !tanggal)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`} />
              {submitted && !tanggal && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Deadline <span className="text-red-500">*</span></label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`w-full px-3 py-2 border ${err(submitted && !deadline)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`} />
              {submitted && !deadline && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
          </div>

          {/* Total Nilai */}
          <div>
            <label className="text-sm font-medium block mb-1">Total Nilai (Rp)</label>
            <input
              type="number"
              min="0"
              value={totalAmount || ''}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="0"
            />
            {totalAmount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">{currency(totalAmount)}</p>
            )}
          </div>

          {/* Upload PDF */}
          <div>
            <label className="text-sm font-medium block mb-1">Upload File PDF</label>
            <label className="flex items-center justify-center w-full h-12 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors text-sm text-muted-foreground gap-2">
              <Upload className="h-4 w-4" />
              {file ? file.name : (initial?.fileUrl ? 'Ganti file PDF' : 'Pilih file PDF')}
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !deadline} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function QuotationPage() {
  const { user } = useAuthStore()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [adminUsers, setAdminUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Quotation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<QuotationStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const isSales = user?.role === 'sales'

  useEffect(() => {
    const unsubQ = subscribeToCollection('quotations', [], (docs) => {
      setQuotations(
        docs.map((d) => ({
          ...d,
          deadline: toDate(d.deadline as never) ?? new Date(),
          createdAt: toDate(d.createdAt as never) ?? new Date(),
          tanggal: toDate(d.tanggal as never),
        })) as unknown as Quotation[]
      )
    })
    const unsubS = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => {
      setSalesUsers(docs as unknown as User[])
    })
    const unsubA = subscribeToCollection('users', [where('role', '==', 'admin')], (docs) => {
      setAdminUsers(docs as unknown as User[])
    })
    return () => { unsubQ(); unsubS(); unsubA() }
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('quotations', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const userName = (id?: string, list?: User[]) =>
    (list ?? [...salesUsers, ...adminUsers]).find((u) => u.id === id)?.name ?? '-'

  // super_admin lihat semua; admin hanya lihat yang picAdmin-nya diri sendiri;
  // sales hanya lihat yang picSales-nya diri sendiri
  const visible = quotations.filter((q) => {
    if (user?.role === 'super_admin') return true
    if (isSales) return q.picSales === user?.id
    // admin: lihat yang ditugaskan ke mereka ATAU yang belum ada picAdmin
    return !q.picAdmin || q.picAdmin === user?.id
  })

  const filtered = visible.filter((q) => {
    const q2 = search.toLowerCase()
    const matchSearch =
      q.id.toLowerCase().includes(q2) ||
      (q.customerName ?? '').toLowerCase().includes(q2) ||
      (q.machineName ?? '').toLowerCase().includes(q2) ||
      (q.lokasi ?? '').toLowerCase().includes(q2)
    const matchStatus = filterStatus === 'all' || q.status === filterStatus
    return matchSearch && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // KPI
  const totalNilai = visible.reduce((s, q) => s + (q.totalAmount ?? 0), 0)
  const pendingRequests = visible.filter((q) => q.isRequest && q.status === 'diproses').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Quotation</h1>
          <p className="text-sm text-muted-foreground">Manajemen penawaran harga ke customer</p>
        </div>
        <div className="flex gap-2">
          {isSales && (
            <button
              onClick={() => setShowRequestForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            >
              <SendHorizonal className="h-4 w-4" />
              Request Quotation
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { setEditTarget(null); setShowForm(true) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Buat Quotation
            </button>
          )}
        </div>
      </div>

      {/* Notifikasi request pending untuk admin */}
      {isAdmin && pendingRequests > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl text-sm">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-amber-800 dark:text-amber-200">
            Ada <strong>{pendingRequests} request quotation</strong> dari Sales yang menunggu dikerjakan.
          </span>
          <button
            onClick={() => setFilterStatus('diproses')}
            className="ml-auto text-xs text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900"
          >
            Lihat
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {(() => {
        const cards = [
          {
            label: 'Total Quotation',
            display: String(visible.length),
            icon: <TrendingUp className="h-5 w-5" />,
            color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
            filter: null as QuotationStatus | 'all' | null,
          },
          {
            label: 'Diproses',
            display: String(visible.filter((q) => q.status === 'diproses').length),
            icon: <RefreshCw className="h-5 w-5" />,
            color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
            filter: 'diproses' as QuotationStatus | 'all' | null,
          },
          {
            label: 'Pending',
            display: String(visible.filter((q) => q.status === 'pending').length),
            icon: <Clock className="h-5 w-5" />,
            color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
            filter: 'pending' as QuotationStatus | 'all' | null,
          },
          {
            label: 'Selesai',
            display: String(visible.filter((q) => q.status === 'selesai').length),
            icon: <CheckCircle2 className="h-5 w-5" />,
            color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
            filter: 'selesai' as QuotationStatus | 'all' | null,
          },
          {
            label: 'Total Nilai',
            display: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(totalNilai),
            icon: <Banknote className="h-5 w-5" />,
            color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
            filter: null as QuotationStatus | 'all' | null,
          },
        ]
        return (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {cards.map((c) => {
              const isActive = c.filter !== null && filterStatus === c.filter
              return (
                <button
                  key={c.label}
                  onClick={() => {
                    if (!c.filter) return
                    setFilterStatus(isActive ? 'all' : c.filter)
                    setPage(1)
                  }}
                  className={cn(
                    'bg-card border rounded-xl p-4 text-left transition-all',
                    c.filter ? 'cursor-pointer hover:shadow-md' : 'cursor-default',
                    isActive ? 'border-primary ring-1 ring-primary/30' : 'border-border'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn('p-2 rounded-lg', c.color)}>{c.icon}</span>
                    <span className="text-2xl font-bold">{c.display}</span>
                  </div>
                  <p className="text-sm font-medium">{c.label}</p>
                </button>
              )
            })}
          </div>
        )
      })()}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari customer, mesin, atau lokasi..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as QuotationStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Status</option>
          <option value="diproses">Diproses</option>
          <option value="pending">Pending</option>
          <option value="selesai">Selesai</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Mesin</th>
                <th className="text-left p-3 font-medium text-muted-foreground">PIC Sales</th>
                <th className="text-left p-3 font-medium text-muted-foreground">PIC Admin</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Lokasi</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Deadline</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((q) => {
                const allUsers = [...salesUsers, ...adminUsers]
                return (
                  <tr key={q.id} className={cn('hover:bg-muted/20', q.isRequest && q.status === 'diproses' && 'bg-amber-50/40 dark:bg-amber-950/20')}>
                    <td className="p-3 font-medium">
                      <div>
                        {q.customerName || '-'}
                        {q.isRequest && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-[10px] rounded font-medium">
                            Request
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{q.machineName || '-'}</td>
                    <td className="p-3 text-muted-foreground text-xs">{userName(q.picSales, allUsers)}</td>
                    <td className="p-3 text-muted-foreground text-xs">{userName(q.picAdmin, adminUsers) !== '-' ? userName(q.picAdmin, adminUsers) : '-'}</td>
                    <td className="p-3 text-muted-foreground text-xs">{q.lokasi || '-'}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {format(q.deadline, 'd MMM yyyy', { locale: localeId })}
                    </td>
                    <td className="p-3 font-semibold">{q.totalAmount > 0 ? currency(q.totalAmount) : <span className="text-muted-foreground font-normal">—</span>}</td>
                    <td className="p-3">
                      <span className={cn('px-2 py-0.5 text-xs rounded-full', STATUS_COLORS[q.status])}>
                        {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {q.totalAmount > 0 && (
                          <button
                            onClick={() => generateQuotationPDF(q, q.customerName || 'Customer')}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Download className="h-3 w-3" /> PDF
                          </button>
                        )}
                        {q.fileUrl && (
                          <a href={q.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline">File</a>
                        )}
                        {isAdmin && (
                          <>
                            <button onClick={() => setEditTarget(q)} className="p-1 text-muted-foreground hover:text-foreground rounded" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(q)} className="p-1 text-muted-foreground hover:text-destructive rounded" title="Hapus">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">Belum ada quotation</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {/* Form request (Sales) */}
      {showRequestForm && (
        <QuotationRequestForm
          adminUsers={adminUsers}
          salesUsers={salesUsers}
          onClose={() => setShowRequestForm(false)}
        />
      )}

      {/* Form buat/edit (Admin) */}
      {(showForm || editTarget) && (
        <QuotationForm
          salesUsers={salesUsers}
          adminUsers={adminUsers}
          initial={editTarget ?? undefined}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus quotation untuk "${deleteTarget.customerName || deleteTarget.id}"? Tindakan ini tidak dapat dibatalkan.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
