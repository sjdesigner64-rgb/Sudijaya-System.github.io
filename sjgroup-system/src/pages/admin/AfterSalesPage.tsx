import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, ExternalLink, Search } from 'lucide-react'
import { cn } from '@/utils/cn'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import type { AfterSales, Customer, User, ComplaintType, TicketPriority, TicketStatus, WarrantyStatus } from '@/types'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const COMPLAINT_LABELS: Record<ComplaintType, string> = {
  kerusakan: 'Kerusakan',
  instalasi: 'Instalasi',
  training: 'Training',
  sparepart: 'Sparepart',
  maintenance: 'Maintenance',
}

const PRIORITY_LABELS: Record<TicketPriority, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }
const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-gray-100 dark:bg-gray-800 text-gray-700',
  medium: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  high: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  urgent: 'bg-red-100 dark:bg-red-900 text-red-700',
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  baru: 'Baru',
  diproses: 'Diproses',
  menunggu_sparepart: 'Menunggu Sparepart',
  selesai: 'Selesai',
  cancel: 'Cancel',
}
const STATUS_COLORS: Record<TicketStatus, string> = {
  baru: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  diproses: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  menunggu_sparepart: 'bg-purple-100 dark:bg-purple-900 text-purple-700',
  selesai: 'bg-green-100 dark:bg-green-900 text-green-700',
  cancel: 'bg-red-100 dark:bg-red-900 text-red-700',
}

const WARRANTY_LABELS: Record<WarrantyStatus, string> = { aktif: 'Aktif', habis: 'Habis', tidak_garansi: 'Tidak Garansi' }
const WARRANTY_COLORS: Record<WarrantyStatus, string> = {
  aktif: 'bg-green-100 dark:bg-green-900 text-green-700',
  habis: 'bg-red-100 dark:bg-red-900 text-red-700',
  tidak_garansi: 'bg-gray-100 dark:bg-gray-800 text-gray-700',
}

const toDateInput = (d?: Date) => (d ? d.toISOString().slice(0, 10) : '')

interface TicketFormProps {
  customers: Customer[]
  salesUsers: User[]
  fabrikasiUsers: User[]
  initial?: AfterSales
  onClose: () => void
}

function TicketForm({ customers, salesUsers, fabrikasiUsers, initial, onClose }: TicketFormProps) {
  const [saving, setSaving] = useState(false)
  const [reportDate, setReportDate] = useState(toDateInput(initial?.reportDate) || new Date().toISOString().slice(0, 10))
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.id ?? '')
  const [machineName, setMachineName] = useState(initial?.machineName ?? '')
  const [complaintType, setComplaintType] = useState<ComplaintType>(initial?.complaintType ?? 'kerusakan')
  const [problemDescription, setProblemDescription] = useState(initial?.problemDescription ?? '')
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? '')
  const [priority, setPriority] = useState<TicketPriority>(initial?.priority ?? 'medium')
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>(initial?.ticketStatus ?? 'baru')
  const [picAftersales, setPicAftersales] = useState(initial?.picAftersales ?? salesUsers[0]?.id ?? '')
  const [technicianAssigned, setTechnicianAssigned] = useState(initial?.technicianAssigned ?? '')
  const [purchaseDate, setPurchaseDate] = useState(toDateInput(initial?.purchaseDate))
  const [installationDate, setInstallationDate] = useState(toDateInput(initial?.installationDate))
  const [warrantyPeriod, setWarrantyPeriod] = useState(initial?.warrantyPeriod ?? '')
  const [warrantyStatus, setWarrantyStatus] = useState<WarrantyStatus>(initial?.warrantyStatus ?? 'aktif')
  const [handlingDeadline, setHandlingDeadline] = useState(toDateInput(initial?.handlingDeadline))

  const handleSave = async () => {
    if (!machineName.trim() || !customerId) return
    setSaving(true)
    try {
      const customerName = customers.find((c) => c.id === customerId)?.name
      const data = {
        reportDate: new Date(reportDate),
        customerId,
        customerName,
        machineName,
        complaintType,
        problemDescription,
        mediaUrl: mediaUrl || undefined,
        priority,
        ticketStatus,
        picAftersales,
        technicianAssigned: technicianAssigned || undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        installationDate: installationDate ? new Date(installationDate) : undefined,
        warrantyPeriod: warrantyPeriod || undefined,
        warrantyStatus,
        handlingDeadline: handlingDeadline ? new Date(handlingDeadline) : undefined,
      }
      if (initial) {
        await updateDocument('after_sales', initial.id, data)
      } else {
        await createDoc('after_sales', { ...data, createdBy: picAftersales })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl p-5 my-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Tiket After-Sales' : 'Tambah Tiket After-Sales'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Tanggal Laporan</label>
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Nama Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium block mb-1">Nama Mesin</label>
            <input value={machineName} onChange={(e) => setMachineName(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Mesin yang bermasalah" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Jenis Keluhan</label>
            <select value={complaintType} onChange={(e) => setComplaintType(e.target.value as ComplaintType)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {(Object.entries(COMPLAINT_LABELS) as [ComplaintType, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Prioritas</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {(Object.entries(PRIORITY_LABELS) as [TicketPriority, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium block mb-1">Deskripsi Masalah</label>
            <textarea value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-20" placeholder="Penjelasan detail masalah..." />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium block mb-1">Link Foto / Video Masalah</label>
            <input type="url" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="https://drive.google.com/..." />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Status Tiket</label>
            <select value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value as TicketStatus)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {(Object.entries(STATUS_LABELS) as [TicketStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Deadline Penanganan</label>
            <input type="date" value={handlingDeadline} onChange={(e) => setHandlingDeadline(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">PIC Aftersales</label>
            <select value={picAftersales} onChange={(e) => setPicAftersales(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {salesUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Teknisi Ditugaskan</label>
            <select value={technicianAssigned} onChange={(e) => setTechnicianAssigned(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">- Belum ditugaskan -</option>
              {fabrikasiUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Tanggal Pembelian</label>
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Tanggal Instalasi</label>
            <input type="date" value={installationDate} onChange={(e) => setInstallationDate(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Masa Garansi</label>
            <input value={warrantyPeriod} onChange={(e) => setWarrantyPeriod(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Contoh: 1 tahun" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Status Garansi</label>
            <select value={warrantyStatus} onChange={(e) => setWarrantyStatus(e.target.value as WarrantyStatus)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {(Object.entries(WARRANTY_LABELS) as [WarrantyStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !machineName.trim() || !customerId} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function AfterSalesPage() {
  const [tickets, setTickets] = useState<AfterSales[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [fabrikasiUsers, setFabrikasiUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editTicket, setEditTicket] = useState<AfterSales | undefined>()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<AfterSales | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubA = subscribeToCollection('after_sales', [], (docs) => {
      setTickets(
        docs.map((d) => ({
          ...d,
          reportDate: toDate(d.reportDate as never) ?? new Date(),
          purchaseDate: toDate(d.purchaseDate as never),
          installationDate: toDate(d.installationDate as never),
          handlingDeadline: toDate(d.handlingDeadline as never),
        })) as unknown as AfterSales[]
      )
    })
    const unsubC = subscribeToCollection('customers', [], (docs) => setCustomers(docs as unknown as Customer[]))
    const unsubS = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => setSalesUsers(docs as unknown as User[]))
    const unsubF = subscribeToCollection('users', [where('role', '==', 'fabrikasi')], (docs) => setFabrikasiUsers(docs as unknown as User[]))
    return () => { unsubA(); unsubC(); unsubS(); unsubF() }
  }, [])

  const userName = (id?: string, list?: User[]) => list?.find((u) => u.id === id)?.name ?? '-'

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('after_sales', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase()
    const matchSearch = t.machineName.toLowerCase().includes(q) || (t.customerName ?? '').toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || t.ticketStatus === filterStatus
    return matchSearch && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">After-Sales</h1>
          <p className="text-sm text-muted-foreground">Tiket layanan purna jual & garansi customer</p>
        </div>
        <button
          onClick={() => { setEditTicket(undefined); setShowForm(true) }}
          disabled={customers.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Tambah Tiket
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari nama mesin atau customer..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as TicketStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Status</option>
          <option value="baru">Baru</option>
          <option value="diproses">Diproses</option>
          <option value="menunggu_sparepart">Menunggu Sparepart</option>
          <option value="selesai">Selesai</option>
          <option value="cancel">Cancel</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Tgl Laporan</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Mesin</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Keluhan</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Prioritas</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Status Tiket</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Teknisi</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Garansi</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Deadline</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Media</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((t) => (
                <tr key={t.id} className="hover:bg-muted/20">
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{format(t.reportDate, 'd MMM yyyy', { locale: localeId })}</td>
                  <td className="p-3 font-medium whitespace-nowrap">{t.customerName}</td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">{t.machineName}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{COMPLAINT_LABELS[t.complaintType]}</td>
                  <td className="p-3"><span className={cn('px-2 py-0.5 text-xs rounded-full', PRIORITY_COLORS[t.priority])}>{PRIORITY_LABELS[t.priority]}</span></td>
                  <td className="p-3"><span className={cn('px-2 py-0.5 text-xs rounded-full whitespace-nowrap', STATUS_COLORS[t.ticketStatus])}>{STATUS_LABELS[t.ticketStatus]}</span></td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{userName(t.picAftersales, salesUsers)}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{userName(t.technicianAssigned, fabrikasiUsers)}</td>
                  <td className="p-3"><span className={cn('px-2 py-0.5 text-xs rounded-full whitespace-nowrap', WARRANTY_COLORS[t.warrantyStatus])}>{WARRANTY_LABELS[t.warrantyStatus]}</span></td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{t.handlingDeadline ? format(t.handlingDeadline, 'd MMM yyyy', { locale: localeId }) : '-'}</td>
                  <td className="p-3">
                    {t.mediaUrl ? (
                      <a href={t.mediaUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : <span className="text-muted-foreground text-xs">-</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <button onClick={() => { setEditTicket(t); setShowForm(true) }} className="text-xs text-primary hover:underline">Edit</button>
                      <button onClick={() => setDeleteTarget(t)} className="text-muted-foreground hover:text-destructive" title="Hapus">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">Belum ada tiket after-sales</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <TicketForm
          customers={customers}
          salesUsers={salesUsers}
          fabrikasiUsers={fabrikasiUsers}
          initial={editTicket}
          onClose={() => { setShowForm(false); setEditTicket(undefined) }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus tiket "${deleteTarget.machineName}" (${deleteTarget.customerName})?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
