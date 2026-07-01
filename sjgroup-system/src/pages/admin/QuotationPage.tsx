import { useEffect, useState } from 'react'
import { Plus, Download, Trash2, Pencil, Upload, Loader2, Search, TrendingUp, RefreshCw, Clock, CheckCircle2, Banknote } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type { Quotation, QuotationStatus, QuotationItem, Project, User } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { generateQuotationPDF } from '@/utils/pdf'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { notifyQuotationReady } from '@/services/notification.service'
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

interface QuotationFormProps {
  projects: Project[]
  salesUsers: User[]
  initial?: Quotation
  onClose: () => void
}

const err = (invalid: boolean) =>
  invalid ? 'border-red-400 dark:border-red-600' : 'border-input'

function QuotationForm({ projects, salesUsers, initial, onClose }: QuotationFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [projectId, setProjectId] = useState(initial?.projectId ?? projects[0]?.id ?? '')
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '')
  const [machineName, setMachineName] = useState(initial?.machineName ?? '')
  const [picSales, setPicSales] = useState(initial?.picSales ?? salesUsers[0]?.id ?? '')
  const [lokasi, setLokasi] = useState(initial?.lokasi ?? '')
  const [tanggal, setTanggal] = useState(
    initial?.tanggal ? format(new Date(initial.tanggal), 'yyyy-MM-dd') : ''
  )
  const [deadline, setDeadline] = useState(
    initial?.deadline ? format(new Date(initial.deadline), 'yyyy-MM-dd') : ''
  )
  const [status, setStatus] = useState<QuotationStatus>(initial?.status ?? 'diproses')
  const [items, setItems] = useState<QuotationItem[]>(
    initial?.items ?? [{ description: '', qty: 1, unit: 'unit', price: 0 }]
  )
  const [file, setFile] = useState<File | null>(null)

  const addItem = () => setItems([...items, { description: '', qty: 1, unit: 'unit', price: 0 }])
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: keyof QuotationItem, value: string | number) =>
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  const selectedProject = projects.find((p) => p.id === projectId)

  const handleSave = async () => {
    setSubmitted(true)
    if (!customerName.trim() || !machineName.trim() || !tanggal || !deadline || !user) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        projectId: selectedProject?.id ?? '',
        customerId: selectedProject?.customerId ?? '',
        requestedBy: selectedProject?.salesPic ?? picSales,
        createdBy: user.id,
        status,
        deadline: new Date(deadline),
        items,
        totalAmount: total,
        customerName,
        machineName,
        picSales,
        lokasi,
        tanggal: tanggal ? new Date(tanggal) : null,
      }

      if (initial) {
        await updateDocument('quotations', initial.id, payload)
        if (file) {
          const url = await uploadFile(buildPath.quotation(initial.id, file.name), file)
          await updateDocument('quotations', initial.id, { fileUrl: url })
        }
      } else {
        const quotationId = await createDoc('quotations', payload)
        if (file) {
          const url = await uploadFile(buildPath.quotation(quotationId, file.name), file)
          await updateDocument('quotations', quotationId, { fileUrl: url })
        }
        if (picSales) {
          await notifyQuotationReady(picSales, customerName || selectedProject?.name || '', quotationId)
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl p-5 my-4">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Quotation' : 'Buat Quotation'}</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
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
            <label className="text-sm font-medium block mb-1">PIC Sales <span className="text-red-500">*</span></label>
            <select value={picSales} onChange={(e) => setPicSales(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {salesUsers.map((u) => (
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
            <label className="text-sm font-medium block mb-1">Tanggal <span className="text-red-500">*</span></label>
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={`w-full px-3 py-2 border ${err(submitted && !tanggal)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`} />
            {submitted && !tanggal && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Deadline <span className="text-red-500">*</span></label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`w-full px-3 py-2 border ${err(submitted && !deadline)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`} />
            {submitted && !deadline && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Project (opsional)</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— Tanpa project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="diproses">Diproses</option>
              <option value="pending">Pending</option>
              <option value="selesai">Selesai</option>
            </select>
          </div>
        </div>

        {/* Upload PDF */}
        <div className="mb-4">
          <label className="text-sm font-medium block mb-1">Upload File PDF</label>
          <label className="flex items-center justify-center w-full h-14 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors text-sm text-muted-foreground gap-2">
            <Upload className="h-4 w-4" />
            {file ? file.name : (initial?.fileUrl ? 'Ganti file PDF' : 'Pilih file PDF')}
            <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {/* Items */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Item Penawaran</label>
            <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Plus className="h-3 w-3" /> Tambah Baris
            </button>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1 text-xs text-muted-foreground px-1">
              <span className="col-span-5">Deskripsi</span>
              <span className="col-span-2">Qty</span>
              <span className="col-span-2">Satuan</span>
              <span className="col-span-2">Harga</span>
              <span className="col-span-1" />
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-1">
                <input value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="col-span-5 px-2 py-1.5 border border-input rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Deskripsi item" />
                <input type="number" value={item.qty || ''} onChange={(e) => updateItem(i, 'qty', Number(e.target.value))} className="col-span-2 px-2 py-1.5 border border-input rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                <input value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} className="col-span-2 px-2 py-1.5 border border-input rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                <input type="number" value={item.price || ''} onChange={(e) => updateItem(i, 'price', Number(e.target.value))} className="col-span-2 px-2 py-1.5 border border-input rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="0" />
                <button onClick={() => removeItem(i)} className="col-span-1 flex items-center justify-center text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-2 text-sm font-semibold">
            Total: {currency(total)}
          </div>
        </div>

        <div className="flex gap-2">
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

export function QuotationPage() {
  const { user } = useAuthStore()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
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
    const unsubP = subscribeToCollection('projects', [], (docs) => {
      setProjects(docs as unknown as Project[])
    })
    const unsubS = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => {
      setSalesUsers(docs as unknown as User[])
    })
    return () => { unsubQ(); unsubP(); unsubS() }
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

  const salesName = (id?: string) => salesUsers.find((u) => u.id === id)?.name ?? '-'

  const visible = quotations.filter((q) => !isSales || q.picSales === user?.id)

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Quotation</h1>
          <p className="text-sm text-muted-foreground">Manajemen penawaran harga ke customer</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Buat Quotation
          </button>
        )}
      </div>

      {/* KPI Cards */}
      {(() => {
        const totalNilai = visible.reduce((s, q) => s + (q.totalAmount ?? 0), 0)
        const cards = [
          {
            label: 'Total Quotation',
            value: visible.length,
            display: String(visible.length),
            icon: <TrendingUp className="h-5 w-5" />,
            color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
            filter: null as QuotationStatus | 'all' | null,
          },
          {
            label: 'Diproses',
            value: visible.filter((q) => q.status === 'diproses').length,
            display: String(visible.filter((q) => q.status === 'diproses').length),
            icon: <RefreshCw className="h-5 w-5" />,
            color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
            filter: 'diproses' as QuotationStatus | 'all' | null,
          },
          {
            label: 'Pending',
            value: visible.filter((q) => q.status === 'pending').length,
            display: String(visible.filter((q) => q.status === 'pending').length),
            icon: <Clock className="h-5 w-5" />,
            color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
            filter: 'pending' as QuotationStatus | 'all' | null,
          },
          {
            label: 'Selesai',
            value: visible.filter((q) => q.status === 'selesai').length,
            display: String(visible.filter((q) => q.status === 'selesai').length),
            icon: <CheckCircle2 className="h-5 w-5" />,
            color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
            filter: 'selesai' as QuotationStatus | 'all' | null,
          },
          {
            label: 'Total Nilai',
            value: totalNilai,
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
                <th className="text-left p-3 font-medium text-muted-foreground">Nama Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Mesin</th>
                <th className="text-left p-3 font-medium text-muted-foreground">PIC Sales</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Lokasi</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Tanggal</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Deadline</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((q) => {
                const project = projects.find((p) => p.id === q.projectId)
                return (
                  <tr key={q.id} className="hover:bg-muted/20">
                    <td className="p-3 font-medium">{q.customerName || project?.customerName || '-'}</td>
                    <td className="p-3 text-muted-foreground">{q.machineName || '-'}</td>
                    <td className="p-3 text-muted-foreground text-xs">{salesName(q.picSales)}</td>
                    <td className="p-3 text-muted-foreground text-xs">{q.lokasi || '-'}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {q.tanggal ? format(new Date(q.tanggal), 'd MMM yyyy', { locale: localeId }) : '-'}
                    </td>
                    <td className="p-3 font-semibold">{currency(q.totalAmount)}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {format(q.deadline, 'd MMM yyyy', { locale: localeId })}
                    </td>
                    <td className="p-3">
                      <span className={cn('px-2 py-0.5 text-xs rounded-full', STATUS_COLORS[q.status])}>
                        {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generateQuotationPDF(q, q.customerName || project?.customerName || 'Customer')}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Download className="h-3 w-3" /> PDF
                        </button>
                        {q.fileUrl && (
                          <a href={q.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline">File</a>
                        )}
                        {isAdmin && (
                          <>
                            <button onClick={() => setEditTarget(q)} className="p-1 text-muted-foreground hover:text-foreground rounded">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(q)} className="p-1 text-muted-foreground hover:text-destructive rounded">
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

      {showForm && (
        <QuotationForm
          projects={projects}
          salesUsers={salesUsers}
          onClose={() => setShowForm(false)}
        />
      )}
      {editTarget && (
        <QuotationForm
          projects={projects}
          salesUsers={salesUsers}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
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
