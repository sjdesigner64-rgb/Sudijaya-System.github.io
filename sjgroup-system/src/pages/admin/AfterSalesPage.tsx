import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, ExternalLink, Search, Inbox, RefreshCw, Package, CheckCircle2, AlertTriangle, Pencil } from 'lucide-react'
import { cn } from '@/utils/cn'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import type { AfterSales, Project, Lead, User, ComplaintType, TicketPriority, TicketStatus, WarrantyStatus } from '@/types'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const COMPLAINT_LABELS: Record<ComplaintType, string> = {
  kerusakan: 'Kerusakan', instalasi: 'Instalasi', training: 'Training',
  sparepart: 'Sparepart', maintenance: 'Maintenance',
}
const PRIORITY_LABELS: Record<TicketPriority, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }
const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-gray-100 dark:bg-gray-800 text-gray-700',
  medium: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  high: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  urgent: 'bg-red-100 dark:bg-red-900 text-red-700',
}
const STATUS_LABELS: Record<TicketStatus, string> = {
  baru: 'Baru', diproses: 'Diproses', menunggu_sparepart: 'Menunggu Sparepart', selesai: 'Selesai', cancel: 'Cancel',
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
const err = (invalid: boolean) => invalid ? 'border-red-400 dark:border-red-600' : 'border-input'

// ─── Shared form fields (bawah form) ──────────────────────────────────────────
function SharedFields({
  machineName, setMachineName,
  complaintType, setComplaintType,
  priority, setPriority,
  problemDescription, setProblemDescription,
  mediaUrl, setMediaUrl,
  ticketStatus, setTicketStatus,
  handlingDeadline, setHandlingDeadline,
  picAftersales, setPicAftersales,
  technicianAssigned, setTechnicianAssigned,
  purchaseDate, setPurchaseDate,
  installationDate, setInstallationDate,
  warrantyPeriod, setWarrantyPeriod,
  warrantyStatus, setWarrantyStatus,
  salesUsers, fabrikasiUsers,
  submitted,
}: {
  machineName: string; setMachineName: (v: string) => void
  complaintType: ComplaintType; setComplaintType: (v: ComplaintType) => void
  priority: TicketPriority; setPriority: (v: TicketPriority) => void
  problemDescription: string; setProblemDescription: (v: string) => void
  mediaUrl: string; setMediaUrl: (v: string) => void
  ticketStatus: TicketStatus; setTicketStatus: (v: TicketStatus) => void
  handlingDeadline: string; setHandlingDeadline: (v: string) => void
  picAftersales: string; setPicAftersales: (v: string) => void
  technicianAssigned: string; setTechnicianAssigned: (v: string) => void
  purchaseDate: string; setPurchaseDate: (v: string) => void
  installationDate: string; setInstallationDate: (v: string) => void
  warrantyPeriod: string; setWarrantyPeriod: (v: string) => void
  warrantyStatus: WarrantyStatus; setWarrantyStatus: (v: WarrantyStatus) => void
  salesUsers: User[]; fabrikasiUsers: User[]
  submitted: boolean
}) {
  return (
    <>
      <div className="col-span-2">
        <label className="text-sm font-medium block mb-1">Nama Mesin <span className="text-red-500">*</span></label>
        <input value={machineName} onChange={(e) => setMachineName(e.target.value)}
          className={`w-full px-3 py-2 border ${err(submitted && !machineName.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
          placeholder="Mesin yang bermasalah" />
        {submitted && !machineName.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Jenis Keluhan <span className="text-red-500">*</span></label>
        <select value={complaintType} onChange={(e) => setComplaintType(e.target.value as ComplaintType)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          {(Object.entries(COMPLAINT_LABELS) as [ComplaintType, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Prioritas <span className="text-red-500">*</span></label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          {(Object.entries(PRIORITY_LABELS) as [TicketPriority, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>
      <div className="col-span-2">
        <label className="text-sm font-medium block mb-1">Deskripsi Masalah <span className="text-red-500">*</span></label>
        <textarea value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)}
          className={`w-full px-3 py-2 border ${err(submitted && !problemDescription.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-20`}
          placeholder="Penjelasan detail masalah..." />
        {submitted && !problemDescription.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
      </div>
      <div className="col-span-2">
        <label className="text-sm font-medium block mb-1">Link Foto / Video Masalah</label>
        <input type="url" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="https://drive.google.com/..." />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Status Tiket <span className="text-red-500">*</span></label>
        <select value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value as TicketStatus)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          {(Object.entries(STATUS_LABELS) as [TicketStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Deadline Penanganan</label>
        <input type="date" value={handlingDeadline} onChange={(e) => setHandlingDeadline(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">PIC Aftersales <span className="text-red-500">*</span></label>
        <select value={picAftersales} onChange={(e) => setPicAftersales(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          {salesUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Teknisi Ditugaskan</label>
        <select value={technicianAssigned} onChange={(e) => setTechnicianAssigned(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">- Belum ditugaskan -</option>
          {fabrikasiUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Tanggal Pembelian</label>
        <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Tanggal Instalasi</label>
        <input type="date" value={installationDate} onChange={(e) => setInstallationDate(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Masa Garansi</label>
        <input value={warrantyPeriod} onChange={(e) => setWarrantyPeriod(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Contoh: 1 tahun" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Status Garansi</label>
        <select value={warrantyStatus} onChange={(e) => setWarrantyStatus(e.target.value as WarrantyStatus)}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          {(Object.entries(WARRANTY_LABELS) as [WarrantyStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>
    </>
  )
}

// ─── Form: Project Sales ───────────────────────────────────────────────────────
function SalesTicketForm({ projects, salesUsers, fabrikasiUsers, initial, onClose }: {
  projects: Project[]; salesUsers: User[]; fabrikasiUsers: User[]; initial?: AfterSales; onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reportDate, setReportDate] = useState(toDateInput(initial?.reportDate) || new Date().toISOString().slice(0, 10))
  const [projectId, setProjectId] = useState(initial?.projectId ?? projects[0]?.id ?? '')
  const [machineName, setMachineName] = useState(initial?.machineName ?? '')
  const [complaintType, setComplaintType] = useState<ComplaintType>(initial?.complaintType ?? 'kerusakan')
  const [priority, setPriority] = useState<TicketPriority>(initial?.priority ?? 'medium')
  const [problemDescription, setProblemDescription] = useState(initial?.problemDescription ?? '')
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? '')
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>(initial?.ticketStatus ?? 'baru')
  const [handlingDeadline, setHandlingDeadline] = useState(toDateInput(initial?.handlingDeadline))
  const [picAftersales, setPicAftersales] = useState(initial?.picAftersales ?? salesUsers[0]?.id ?? '')
  const [technicianAssigned, setTechnicianAssigned] = useState(initial?.technicianAssigned ?? '')
  const [purchaseDate, setPurchaseDate] = useState(toDateInput(initial?.purchaseDate))
  const [installationDate, setInstallationDate] = useState(toDateInput(initial?.installationDate))
  const [warrantyPeriod, setWarrantyPeriod] = useState(initial?.warrantyPeriod ?? '')
  const [warrantyStatus, setWarrantyStatus] = useState<WarrantyStatus>(initial?.warrantyStatus ?? 'aktif')

  const selectedProject = projects.find((p) => p.id === projectId)

  const handleSave = async () => {
    setSubmitted(true)
    if (!projectId || !machineName.trim() || !problemDescription.trim()) return
    setSaving(true)
    try {
      const data = {
        reportDate: new Date(reportDate),
        projectId,
        leadId: null,
        customerId: selectedProject?.customerId ?? '',
        customerName: selectedProject?.customerName ?? selectedProject?.name ?? '',
        machineName, complaintType, problemDescription,
        mediaUrl: mediaUrl || undefined, priority, ticketStatus, picAftersales,
        technicianAssigned: technicianAssigned || undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        installationDate: installationDate ? new Date(installationDate) : undefined,
        warrantyPeriod: warrantyPeriod || undefined, warrantyStatus,
        handlingDeadline: handlingDeadline ? new Date(handlingDeadline) : undefined,
      }
      if (initial) await updateDocument('after_sales', initial.id, data)
      else await createDoc('after_sales', { ...data, createdBy: picAftersales })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl p-5 my-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Tiket — Project Sales' : 'Tambah Tiket — Project Sales'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Tanggal Laporan <span className="text-red-500">*</span></label>
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Project Sales <span className="text-red-500">*</span></label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {projects.map((p) => (<option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>))}
            </select>
          </div>
          <SharedFields {...{
            machineName, setMachineName, complaintType, setComplaintType, priority, setPriority,
            problemDescription, setProblemDescription, mediaUrl, setMediaUrl,
            ticketStatus, setTicketStatus, handlingDeadline, setHandlingDeadline,
            picAftersales, setPicAftersales, technicianAssigned, setTechnicianAssigned,
            purchaseDate, setPurchaseDate, installationDate, setInstallationDate,
            warrantyPeriod, setWarrantyPeriod, warrantyStatus, setWarrantyStatus,
            salesUsers, fabrikasiUsers, submitted,
          }} />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Form: Project Satuan ──────────────────────────────────────────────────────
function SatuanTicketForm({ leads, salesUsers, fabrikasiUsers, initial, onClose }: {
  leads: Lead[]; salesUsers: User[]; fabrikasiUsers: User[]; initial?: AfterSales; onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reportDate, setReportDate] = useState(toDateInput(initial?.reportDate) || new Date().toISOString().slice(0, 10))
  const [leadId, setLeadId] = useState(initial?.leadId ?? leads[0]?.id ?? '')
  const [machineName, setMachineName] = useState(initial?.machineName ?? '')
  const [complaintType, setComplaintType] = useState<ComplaintType>(initial?.complaintType ?? 'kerusakan')
  const [priority, setPriority] = useState<TicketPriority>(initial?.priority ?? 'medium')
  const [problemDescription, setProblemDescription] = useState(initial?.problemDescription ?? '')
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? '')
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>(initial?.ticketStatus ?? 'baru')
  const [handlingDeadline, setHandlingDeadline] = useState(toDateInput(initial?.handlingDeadline))
  const [picAftersales, setPicAftersales] = useState(initial?.picAftersales ?? salesUsers[0]?.id ?? '')
  const [technicianAssigned, setTechnicianAssigned] = useState(initial?.technicianAssigned ?? '')
  const [purchaseDate, setPurchaseDate] = useState(toDateInput(initial?.purchaseDate))
  const [installationDate, setInstallationDate] = useState(toDateInput(initial?.installationDate))
  const [warrantyPeriod, setWarrantyPeriod] = useState(initial?.warrantyPeriod ?? '')
  const [warrantyStatus, setWarrantyStatus] = useState<WarrantyStatus>(initial?.warrantyStatus ?? 'aktif')

  const selectedLead = leads.find((l) => l.id === leadId)

  // Auto-fill machineName dari lead saat tambah baru
  const [machineInit, setMachineInit] = useState(false)
  if (!machineInit && !initial && selectedLead && !machineName) {
    setMachineName(selectedLead.productName)
    setMachineInit(true)
  }

  const handleLeadChange = (id: string) => {
    setLeadId(id)
    const lead = leads.find((l) => l.id === id)
    if (lead && !initial) setMachineName(lead.productName)
  }

  const handleSave = async () => {
    setSubmitted(true)
    if (!leadId || !machineName.trim() || !problemDescription.trim()) return
    setSaving(true)
    try {
      const data = {
        reportDate: new Date(reportDate),
        projectId: null,
        leadId,
        customerId: selectedLead?.customerId ?? '',
        customerName: selectedLead?.customerName ?? '',
        machineName, complaintType, problemDescription,
        mediaUrl: mediaUrl || undefined, priority, ticketStatus, picAftersales,
        technicianAssigned: technicianAssigned || undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        installationDate: installationDate ? new Date(installationDate) : undefined,
        warrantyPeriod: warrantyPeriod || undefined, warrantyStatus,
        handlingDeadline: handlingDeadline ? new Date(handlingDeadline) : undefined,
      }
      if (initial) await updateDocument('after_sales', initial.id, data)
      else await createDoc('after_sales', { ...data, createdBy: picAftersales })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl p-5 my-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Tiket — Project Satuan' : 'Tambah Tiket — Project Satuan'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Tanggal Laporan <span className="text-red-500">*</span></label>
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Project Satuan <span className="text-red-500">*</span></label>
            <select value={leadId} onChange={(e) => handleLeadChange(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {leads.map((l) => (<option key={l.id} value={l.id}>{l.customerName} — {l.productName}</option>))}
            </select>
          </div>
          <SharedFields {...{
            machineName, setMachineName, complaintType, setComplaintType, priority, setPriority,
            problemDescription, setProblemDescription, mediaUrl, setMediaUrl,
            ticketStatus, setTicketStatus, handlingDeadline, setHandlingDeadline,
            picAftersales, setPicAftersales, technicianAssigned, setTechnicianAssigned,
            purchaseDate, setPurchaseDate, installationDate, setInstallationDate,
            warrantyPeriod, setWarrantyPeriod, warrantyStatus, setWarrantyStatus,
            salesUsers, fabrikasiUsers, submitted,
          }} />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Ticket Table ──────────────────────────────────────────────────────────────
function TicketTable({ tickets, salesUsers, fabrikasiUsers, onEdit, onDelete }: {
  tickets: AfterSales[]
  salesUsers: User[]
  fabrikasiUsers: User[]
  onEdit: (t: AfterSales) => void
  onDelete: (t: AfterSales) => void
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  const userName = (id?: string, list?: User[]) => list?.find((u) => u.id === id)?.name ?? '-'

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase()
    const matchSearch = t.machineName.toLowerCase().includes(q) || (t.customerName ?? '').toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || t.ticketStatus === filterStatus
    return matchSearch && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── KPI dari semua tickets yang masuk ke tab ini ──
  const urgentCount = tickets.filter((t) => (t.priority === 'urgent' || t.priority === 'high') && t.ticketStatus !== 'selesai' && t.ticketStatus !== 'cancel').length

  const kpiCards = [
    {
      label: 'Baru',
      count: tickets.filter((t) => t.ticketStatus === 'baru').length,
      icon: <Inbox className="h-5 w-5" />,
      color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
      status: 'baru' as TicketStatus | 'all',
    },
    {
      label: 'Diproses',
      count: tickets.filter((t) => t.ticketStatus === 'diproses').length,
      icon: <RefreshCw className="h-5 w-5" />,
      color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
      status: 'diproses' as TicketStatus | 'all',
    },
    {
      label: 'Menunggu Sparepart',
      count: tickets.filter((t) => t.ticketStatus === 'menunggu_sparepart').length,
      icon: <Package className="h-5 w-5" />,
      color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
      status: 'menunggu_sparepart' as TicketStatus | 'all',
    },
    {
      label: 'Selesai',
      count: tickets.filter((t) => t.ticketStatus === 'selesai').length,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
      status: 'selesai' as TicketStatus | 'all',
    },
  ]

  return (
    <div className="space-y-3">
      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((c) => {
          const isActive = filterStatus === c.status
          return (
            <button
              key={c.label}
              onClick={() => { setFilterStatus(isActive ? 'all' : c.status); setPage(1) }}
              className={cn(
                'bg-card border rounded-xl p-4 text-left transition-all cursor-pointer hover:shadow-md',
                isActive ? 'border-primary ring-1 ring-primary/30' : 'border-border'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={cn('p-2 rounded-lg', c.color)}>{c.icon}</span>
                <span className="text-2xl font-bold">{c.count}</span>
              </div>
              <p className="text-sm font-medium">{c.label}</p>
            </button>
          )
        })}
      </div>

      {/* Urgent badge */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><span className="font-semibold">{urgentCount}</span> tiket prioritas High/Urgent masih aktif</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari nama mesin atau customer..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as TicketStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Semua Status</option>
          {(Object.entries(STATUS_LABELS) as [TicketStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
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
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC Aftersales</th>
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
                  <td className="p-3 font-medium whitespace-nowrap">{t.customerName ?? '-'}</td>
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
                      <button onClick={() => onEdit(t)} title="Edit"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onDelete(t)}
                        className="p-1 rounded border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-colors" title="Hapus">
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
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function AfterSalesPage() {
  const [tickets, setTickets] = useState<AfterSales[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [fabrikasiUsers, setFabrikasiUsers] = useState<User[]>([])
  const [activeTab, setActiveTab] = useState<'sales' | 'satuan'>('sales')
  const [showSalesForm, setShowSalesForm] = useState(false)
  const [showSatuanForm, setShowSatuanForm] = useState(false)
  const [editTicket, setEditTicket] = useState<AfterSales | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<AfterSales | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubA = subscribeToCollection('after_sales', [], (docs) =>
      setTickets(docs.map((d) => ({
        ...d,
        reportDate: toDate(d.reportDate as never) ?? new Date(),
        purchaseDate: toDate(d.purchaseDate as never),
        installationDate: toDate(d.installationDate as never),
        handlingDeadline: toDate(d.handlingDeadline as never),
      })) as unknown as AfterSales[])
    )
    const unsubP = subscribeToCollection('projects', [], (docs) => setProjects(docs as unknown as Project[]))
    const unsubL = subscribeToCollection('leads', [], (docs) => setLeads(docs as unknown as Lead[]))
    const unsubS = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => setSalesUsers(docs as unknown as User[]))
    const unsubF = subscribeToCollection('users', [where('role', '==', 'fabrikasi')], (docs) => setFabrikasiUsers(docs as unknown as User[]))
    return () => { unsubA(); unsubP(); unsubL(); unsubS(); unsubF() }
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('after_sales', deleteTarget.id)
      setDeleteTarget(null)
    } finally { setDeleting(false) }
  }

  const handleEdit = (t: AfterSales) => {
    setEditTicket(t)
    if (t.leadId) setShowSatuanForm(true)
    else setShowSalesForm(true)
  }

  const salesTickets = tickets.filter((t) => !t.leadId)
  const satuanTickets = tickets.filter((t) => !!t.leadId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">After-Sales</h1>
          <p className="text-sm text-muted-foreground">Tiket layanan purna jual & garansi customer</p>
        </div>
        <button
          onClick={() => {
            setEditTicket(undefined)
            if (activeTab === 'sales') setShowSalesForm(true)
            else setShowSatuanForm(true)
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Tiket
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {([
          { id: 'sales', label: 'Project Sales', count: salesTickets.length },
          { id: 'satuan', label: 'Project Satuan', count: satuanTickets.length },
        ] as const).map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}>
            {tab.label}
            <span className="ml-1.5 px-1.5 py-0.5 bg-border text-muted-foreground text-xs rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === 'sales' ? (
        <TicketTable
          tickets={salesTickets}
          salesUsers={salesUsers}
          fabrikasiUsers={fabrikasiUsers}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
        />
      ) : (
        <TicketTable
          tickets={satuanTickets}
          salesUsers={salesUsers}
          fabrikasiUsers={fabrikasiUsers}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
        />
      )}

      {showSalesForm && (
        <SalesTicketForm
          projects={projects}
          salesUsers={salesUsers}
          fabrikasiUsers={fabrikasiUsers}
          initial={editTicket}
          onClose={() => { setShowSalesForm(false); setEditTicket(undefined) }}
        />
      )}

      {showSatuanForm && (
        <SatuanTicketForm
          leads={leads}
          salesUsers={salesUsers}
          fabrikasiUsers={fabrikasiUsers}
          initial={editTicket}
          onClose={() => { setShowSatuanForm(false); setEditTicket(undefined) }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus tiket "${deleteTarget.machineName}" (${deleteTarget.customerName ?? '-'})?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
