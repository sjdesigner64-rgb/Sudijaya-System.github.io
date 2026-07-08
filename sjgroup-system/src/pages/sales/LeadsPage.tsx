import { useEffect, useState } from 'react'
import { Plus, Search, Loader2, Trash2, Pencil, Check, TrendingUp, Banknote, CheckCircle, Truck, Lock } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type { Lead, DpPelunasanStatus, PengirimanStatus, ProductCategory, CustomerSource, Customer, User } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { notifyLeadAssigned, notifyShipmentReady } from '@/services/notification.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const shortCost = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1) + ' M'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + ' jt'
  return (n / 1_000).toFixed(0) + ' rb'
}

const DP_LABELS: Record<DpPelunasanStatus, string> = {
  belum_dp: 'Belum DP',
  sudah_dp: 'Sudah DP',
  sudah_lunas: 'Sudah Lunas',
}
const DP_COLORS: Record<DpPelunasanStatus, string> = {
  belum_dp: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  sudah_dp: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  sudah_lunas: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
}

const PENGIRIMAN_LABELS: Record<PengirimanStatus, string> = {
  belum: 'Belum',
  proses: 'Proses',
  selesai: 'Selesai',
}
const PENGIRIMAN_COLORS: Record<PengirimanStatus, string> = {
  belum: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  proses: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
  selesai: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
}

const NEW_CUSTOMER_VALUE = '__new__'

// ─── Track Modal ──────────────────────────────────────────────────────────────
function TrackModal({ lead, adminIds, onClose }: { lead: Lead; adminIds: string[]; onClose: () => void }) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const dp = lead.dpPelunasan ?? 'belum_dp'
  const pkg = lead.pengiriman ?? 'belum'

  const dpDone = dp === 'sudah_dp' || dp === 'sudah_lunas'
  const pelunasanDone = dp === 'sudah_lunas'
  const pengirimanDone = pkg === 'selesai'
  const instalasiDone = lead.instalasi === 'selesai'

  const act = async (updates: Record<string, string>) => {
    setSaving(true)
    try {
      if (updates.dpPelunasan === 'sudah_lunas') {
        const enriched: Record<string, unknown> = { ...updates, pengiriman: 'proses' }
        await updateDocument('leads', lead.id, enriched)
        await createDoc('shipments', {
          projectId: lead.id,
          projectName: `${lead.customerName ?? '-'} — ${lead.productName}`,
          leadId: lead.id,
          picSalesId: lead.assignedSales,
          sku: lead.productName,
          quantity: 1,
          weight: 0,
          dimensions: { length: 0, width: 0, height: 0, unit: 'cm' },
          condition: 'baru',
          picPengiriman: '',
          packingNotes: '',
          createdBy: user?.id ?? '',
        })
        await notifyShipmentReady(lead.assignedSales, adminIds, lead.customerName ?? '-', lead.productName, lead.id)
      } else {
        await updateDocument('leads', lead.id, updates)
      }
    }
    finally { setSaving(false) }
  }

  const STEPS: { label: string; desc: string; done: boolean; locked: boolean; action: () => void }[] = [
    { label: 'DP',          desc: 'Pembayaran uang muka',       done: dpDone,        locked: false,          action: () => act({ dpPelunasan: 'sudah_dp' }) },
    { label: 'Pelunasan',   desc: 'Pelunasan penuh',             done: pelunasanDone, locked: false,          action: () => act({ dpPelunasan: 'sudah_lunas' }) },
    { label: 'Pengiriman',  desc: 'Barang sudah dikirim',        done: pengirimanDone,locked: !pelunasanDone, action: () => act({ pengiriman: 'selesai' }) },
    { label: 'Selesai',     desc: 'Instalasi selesai di lokasi', done: instalasiDone, locked: !pengirimanDone,action: () => act({ instalasi: 'selesai' }) },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm p-5">
        <h3 className="font-semibold mb-1">Track Project Satuan</h3>
        <p className="text-sm text-muted-foreground mb-5">{lead.customerName} — {lead.productName}</p>
        <div className="space-y-2.5">
          {STEPS.map((step, i) => (
            <button
              key={step.label}
              onClick={step.action}
              disabled={saving || step.done || step.locked}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border text-sm text-left transition-colors',
                step.done
                  ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950'
                  : step.locked
                    ? 'border-border bg-muted/30 opacity-60 cursor-not-allowed'
                    : 'border-dashed border-border hover:border-primary/50 hover:bg-accent'
              )}
            >
              <span className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-medium',
                step.done
                  ? 'bg-green-500 text-white'
                  : step.locked
                    ? 'bg-muted text-muted-foreground border-2 border-border'
                    : 'border-2 border-border text-muted-foreground'
              )}>
                {step.done
                  ? <Check className="h-3.5 w-3.5" />
                  : step.locked
                    ? <Lock className="h-3 w-3" />
                    : i + 1}
              </span>
              <div className="flex-1">
                <p className={cn(
                  'font-medium',
                  step.done ? 'text-green-700 dark:text-green-400' : step.locked ? 'text-muted-foreground' : ''
                )}>{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
              {!step.done && !step.locked && (
                <span className="text-xs text-primary border border-primary/30 px-2 py-0.5 rounded shrink-0">
                  {saving ? '...' : 'Tandai'}
                </span>
              )}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-4 py-2 border border-border rounded-md text-sm hover:bg-accent">
          Tutup
        </button>
      </div>
    </div>
  )
}

// ─── Lead Form ────────────────────────────────────────────────────────────────
interface LeadFormProps {
  customers: Customer[]
  salesUsers: User[]
  onClose: () => void
  initial?: Lead
}

const err = (invalid: boolean) =>
  invalid ? 'border-red-400 dark:border-red-600' : 'border-input'

function LeadForm({ customers, salesUsers, onClose, initial }: LeadFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.id ?? NEW_CUSTOMER_VALUE)
  const [newCustomerName, setNewCustomerName] = useState(initial?.customerName ?? '')
  const [assignedSales, setAssignedSales] = useState(() => {
    if (initial?.assignedSales) return initial.assignedSales
    if (user?.role === 'sales') return user.id
    return salesUsers[0]?.id ?? ''
  })

  // Jika salesUsers belum load saat form dibuka, set default saat data tersedia
  useEffect(() => {
    if (!initial && !assignedSales && salesUsers.length > 0) {
      setAssignedSales(user?.role === 'sales' ? (user.id) : salesUsers[0].id)
    }
  }, [salesUsers]) // eslint-disable-line react-hooks/exhaustive-deps
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [tanggal, setTanggal] = useState(
    initial?.tanggal ? format(new Date(initial.tanggal), 'yyyy-MM-dd') : ''
  )
  const [lokasi, setLokasi] = useState(initial?.lokasi ?? '')
  const [alamat, setAlamat] = useState(initial?.alamat ?? '')
  const [estimatedCost, setEstimatedCost] = useState(initial?.estimatedCost ?? 0)
  const [form, setForm] = useState({
    productCategory: initial?.productCategory ?? 'Zenchang' as ProductCategory,
    productName: initial?.productName ?? '',
    source: initial?.source ?? 'whatsapp' as CustomerSource,
    notes: initial?.notes ?? '',
  })

  const isNewCustomer = customerId === NEW_CUSTOMER_VALUE

  const handleSave = async () => {
    setSubmitted(true)
    if (!user || !assignedSales) return
    if (isNewCustomer && !newCustomerName.trim()) return
    if (!isNewCustomer && !customerId) return
    if (!phone.trim() || !tanggal || !form.productName.trim() || !estimatedCost) return
    setSaving(true)
    try {
      if (initial) {
        await updateDocument('leads', initial.id, {
          productCategory: form.productCategory,
          productName: form.productName,
          source: form.source,
          notes: form.notes,
          assignedSales,
          phone,
          tanggal: tanggal ? new Date(tanggal) : null,
          lokasi,
          alamat,
          estimatedCost: estimatedCost || null,
        })
      } else {
        let finalCustomerId = customerId
        let finalCustomerName = customers.find((c) => c.id === customerId)?.name ?? ''

        if (isNewCustomer) {
          finalCustomerName = newCustomerName
          finalCustomerId = await createDoc('customers', {
            name: newCustomerName,
            phone,
            email: '',
            source: form.source,
            status: 'lead',
            isActive: true,
            lastFollowUp: new Date(),
            createdBy: user.id,
          })
        }

        const leadId = await createDoc('leads', {
          customerId: finalCustomerId,
          customerName: finalCustomerName,
          productCategory: form.productCategory,
          productName: form.productName,
          source: form.source,
          assignedSales,
          lastFollowUp: new Date(),
          notes: form.notes,
          phone,
          tanggal: tanggal ? new Date(tanggal) : null,
          lokasi,
          alamat,
          estimatedCost: estimatedCost || null,
          dpPelunasan: 'belum_dp',
          pengiriman: 'belum',
          payments: [],
        })

        if (assignedSales && assignedSales !== user.id) {
          await notifyLeadAssigned(assignedSales, finalCustomerName, leadId)
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <h3 className="font-semibold">{initial ? 'Edit Project Satuan' : 'Tambah Project Satuan'}</h3>
        </div>

        {/* Body — scrollable */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">

          {/* Customer */}
          <div>
            <label className="text-sm font-medium block mb-1">Customer</label>
            {initial ? (
              <input value={initial.customerName} disabled className="w-full px-3 py-2 border border-input rounded-md text-sm bg-muted text-muted-foreground" />
            ) : (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value={NEW_CUSTOMER_VALUE}>+ Customer Baru</option>
              </select>
            )}
            {!initial && isNewCustomer && (
              <input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nama customer / perusahaan baru"
              />
            )}
          </div>

          {/* No. HP + Tanggal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">No. HP <span className="text-red-500">*</span></label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full px-3 py-2 border ${err(submitted && !phone.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
                placeholder="08xxxxxxxxxx"
              />
              {submitted && !phone.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Tanggal <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={`w-full px-3 py-2 border ${err(submitted && !tanggal)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
              />
              {submitted && !tanggal && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
          </div>

          {/* PIC Sales + Brand */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">PIC Sales</label>
              <select
                value={assignedSales}
                onChange={(e) => setAssignedSales(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Brand Mesin</label>
              <select
                value={form.productCategory}
                onChange={(e) => setForm({ ...form, productCategory: e.target.value as ProductCategory })}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(['Zenchang','VNT','Nordic','Zenyer','Lijun','Pinecone'] as ProductCategory[]).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Produk + Sumber */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Produk Diminati <span className="text-red-500">*</span></label>
              <input
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                className={`w-full px-3 py-2 border ${err(submitted && !form.productName.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
                placeholder="Nama produk / mesin"
              />
              {submitted && !form.productName.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Sumber</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as CustomerSource })}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="iklan">Iklan</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>

          {/* Estimasi Biaya */}
          <div>
            <label className="text-sm font-medium block mb-1">Estimasi Biaya (Rp) <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="0"
              value={estimatedCost || ''}
              onChange={(e) => setEstimatedCost(Number(e.target.value))}
              className={`w-full px-3 py-2 border ${err(submitted && !estimatedCost)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
              placeholder="Contoh: 150000000"
            />
            {submitted && !estimatedCost && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>

          {/* Alamat */}
          <div>
            <label className="text-sm font-medium block mb-1">Alamat</label>
            <textarea
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Alamat lengkap customer..."
            />
          </div>

          {/* Catatan */}
          <div>
            <label className="text-sm font-medium block mb-1">Catatan</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Catatan follow-up..."
            />
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
export function LeadsPage() {
  const { user } = useAuthStore()
  const [leads, setLeads] = useState<Lead[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [filterDp, setFilterDp] = useState<DpPelunasanStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editLead, setEditLead] = useState<Lead | undefined>()
  const [trackLead, setTrackLead] = useState<Lead | undefined>()
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [adminUsers, setAdminUsers] = useState<User[]>([])
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubL = subscribeToCollection('leads', [], (docs) => {
      setLeads(
        docs.map((d) => ({
          ...d,
          lastFollowUp: toDate(d.lastFollowUp as never) ?? new Date(),
          tanggal: toDate(d.tanggal as never),
        })) as unknown as Lead[]
      )
    })
    const unsubC = subscribeToCollection('customers', [], (docs) => {
      setCustomers(docs as unknown as Customer[])
    })
    const unsubS = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => {
      setSalesUsers(docs as unknown as User[])
    })
    const unsubA = subscribeToCollection('users', [where('role', '==', 'admin')], (docs) => {
      setAdminUsers(docs as unknown as User[])
    })
    return () => { unsubL(); unsubC(); unsubS(); unsubA() }
  }, [])

  useEffect(() => {
    if (!trackLead) return
    const fresh = leads.find((l) => l.id === trackLead.id)
    if (fresh) setTrackLead(fresh)
  }, [leads]) // eslint-disable-line react-hooks/exhaustive-deps

  const salesName = (id: string) => salesUsers.find((u) => u.id === id)?.name ?? id

  const filtered = leads.filter((l) => {
    const matchSearch =
      (l.customerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      l.productName.toLowerCase().includes(search.toLowerCase()) ||
      (l.alamat ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.phone ?? '').includes(search)
    const matchDp = filterDp === 'all' || (l.dpPelunasan ?? 'belum_dp') === filterDp
    return matchSearch && matchDp
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('leads', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Project Satuan</h1>
          <p className="text-sm text-muted-foreground">Manajemen calon customer dan pipeline satuan</p>
        </div>
        <button
          onClick={() => { setEditLead(undefined); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Project Satuan
        </button>
      </div>

      {/* KPI Cards */}
      {(() => {
        const totalNilai  = leads.reduce((s, l) => s + (l.estimatedCost ?? 0), 0)
        const kirimLeads  = leads.filter((l) => (l.pengiriman ?? 'belum') === 'selesai')
        const lunasLeads  = leads.filter((l) => l.dpPelunasan === 'sudah_lunas' && (l.pengiriman ?? 'belum') !== 'selesai')
        const dpLeads     = leads.filter((l) => l.dpPelunasan === 'sudah_dp')

        const cards = [
          {
            label: 'Total Project',
            count: leads.length,
            nilai: totalNilai,
            icon: <TrendingUp className="h-5 w-5" />,
            color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
            filter: null as DpPelunasanStatus | 'all' | null,
          },
          {
            label: 'DP',
            count: dpLeads.length,
            nilai: dpLeads.reduce((s, l) => s + (l.estimatedCost ?? 0), 0),
            icon: <Banknote className="h-5 w-5" />,
            color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
            filter: 'sudah_dp' as DpPelunasanStatus | 'all' | null,
          },
          {
            label: 'Lunas',
            count: lunasLeads.length,
            nilai: lunasLeads.reduce((s, l) => s + (l.estimatedCost ?? 0), 0),
            icon: <CheckCircle className="h-5 w-5" />,
            color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
            filter: 'sudah_lunas' as DpPelunasanStatus | 'all' | null,
          },
          {
            label: 'Terkirim',
            count: kirimLeads.length,
            nilai: kirimLeads.reduce((s, l) => s + (l.estimatedCost ?? 0), 0),
            icon: <Truck className="h-5 w-5" />,
            color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
            filter: null as DpPelunasanStatus | 'all' | null,
          },
        ]

        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((c) => {
              const isActive = c.filter !== null && filterDp === c.filter
              return (
                <button
                  key={c.label}
                  onClick={() => {
                    if (c.filter === null) return
                    setFilterDp(isActive ? 'all' : c.filter)
                    setPage(1)
                  }}
                  className={cn(
                    'bg-card border rounded-xl p-4 text-left transition-all',
                    c.filter !== null ? 'cursor-pointer hover:shadow-md' : 'cursor-default',
                    isActive ? 'border-primary ring-1 ring-primary/30' : 'border-border'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn('p-2 rounded-lg', c.color)}>{c.icon}</span>
                    <span className="text-2xl font-bold">{c.count}</span>
                  </div>
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.nilai > 0 ? `Rp ${shortCost(c.nilai)}` : '—'}
                  </p>
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
            placeholder="Cari customer, produk, no. hp, atau alamat..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterDp}
          onChange={(e) => { setFilterDp(e.target.value as DpPelunasanStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua DP</option>
          <option value="belum_dp">Belum DP</option>
          <option value="sudah_dp">Sudah DP</option>
          <option value="sudah_lunas">Sudah Lunas</option>
        </select>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(DP_LABELS) as [DpPelunasanStatus, string][]).map(([s, l]) => {
          const count = leads.filter((le) => (le.dpPelunasan ?? 'belum_dp') === s).length
          return (
            <button
              key={s}
              onClick={() => setFilterDp(filterDp === s ? 'all' : s)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                filterDp === s ? DP_COLORS[s] + ' border-transparent' : 'border-border text-muted-foreground hover:border-foreground'
              )}
            >
              {l} ({count})
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Nama Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">No. HP</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Tanggal</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Alamat</th>
                <th className="text-left p-3 font-medium text-muted-foreground">PIC Sales</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Produk</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Brand</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estimasi Biaya</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Tahap</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((lead) => {
                const dp = lead.dpPelunasan ?? 'belum_dp'
                const pkg = lead.pengiriman ?? 'belum'
                return (
                  <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium">{lead.customerName}</td>
                    <td className="p-3 text-muted-foreground text-xs">{lead.phone || '-'}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {lead.tanggal ? format(new Date(lead.tanggal), 'd MMM yyyy', { locale: localeId }) : '-'}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[160px]">
                      <span className="line-clamp-2">{lead.alamat || '-'}</span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{salesName(lead.assignedSales)}</td>
                    <td className="p-3 text-muted-foreground">{lead.productName}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">
                        {lead.productCategory}
                      </span>
                    </td>
                    <td className="p-3">
                      {lead.estimatedCost
                        ? <span className="text-sm font-medium">{shortCost(lead.estimatedCost)}</span>
                        : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        {[
                          { label: 'DP',      done: dp === 'sudah_dp' || dp === 'sudah_lunas' },
                          { label: 'Lunas',   done: dp === 'sudah_lunas' },
                          { label: 'Kirim',   done: pkg === 'selesai' },
                          { label: 'Selesai', done: (lead.instalasi ?? 'belum') === 'selesai' },
                        ].map((step) => (
                          <div key={step.label} className="flex items-center gap-1.5">
                            <span className={cn(
                              'w-2 h-2 rounded-full shrink-0',
                              step.done ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                            )} />
                            <span className={cn(
                              'text-xs',
                              step.done ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'
                            )}>{step.label}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTrackLead(lead)}
                          className="text-xs text-primary hover:underline whitespace-nowrap"
                        >
                          Track
                        </button>
                        <button
                          onClick={() => { setEditLead(lead); setShowForm(true) }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(lead)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Tidak ada project satuan ditemukan
            </div>
          )}
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <LeadForm
          customers={customers}
          salesUsers={salesUsers}
          initial={editLead}
          onClose={() => { setShowForm(false); setEditLead(undefined) }}
        />
      )}

      {trackLead && (
        <TrackModal lead={trackLead} adminIds={adminUsers.map((u) => u.id)} onClose={() => setTrackLead(undefined)} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus project satuan "${deleteTarget.customerName}"? Tindakan ini tidak dapat dibatalkan.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
