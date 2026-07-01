import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2, Trash2, Check, ExternalLink, Search, ArrowRight, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { cn } from '@/utils/cn'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import type { Project, PipelineStage, ProductCategory, Customer, MeetingNote, User } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, getDocuments, where } from '@/services/firestore.service'
import { notifyProjectSalesCreated } from '@/services/notification.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const STAGE_LABELS: Record<PipelineStage, string> = {
  leads: 'Leads',
  dp_layout: 'DP + Layout',
  meeting_fabrikasi: 'Meeting Fabrikasi',
  fabrikasi_build: 'Build Produk',
  pelunasan: 'Pelunasan',
  pengiriman: 'Pengiriman',
  instalasi: 'Instalasi',
}

const STAGES = Object.keys(STAGE_LABELS) as PipelineStage[]
const NEW_CUSTOMER_VALUE = '__new__'

const currency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact' }).format(n)

interface ProjectFormProps {
  customers: Customer[]
  salesUsers: User[]
  initial?: Project
  onClose: () => void
}

const err = (invalid: boolean) =>
  invalid ? 'border-red-400 dark:border-red-600' : 'border-input'

function ProjectForm({ customers, salesUsers, initial, onClose }: ProjectFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState(initial?.name ?? '')
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.id ?? NEW_CUSTOMER_VALUE)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [salesPic, setSalesPic] = useState(initial?.salesPic ?? user?.id ?? salesUsers[0]?.id ?? '')

  // Saat salesUsers selesai load (async), pastikan salesPic menunjuk ke user yang ada di list.
  // Terjadi ketika user login sebagai admin/super_admin — user.id mereka tidak ada di salesUsers.
  useEffect(() => {
    if (initial) return // edit: jangan ubah nilai asli
    if (salesUsers.length === 0) return
    setSalesPic((prev) => {
      if (salesUsers.some((u) => u.id === prev)) return prev // sudah valid
      const preferred = salesUsers.find((u) => u.id === user?.id)
      return preferred?.id ?? salesUsers[0].id
    })
  }, [salesUsers]) // eslint-disable-line react-hooks/exhaustive-deps

  const [category, setCategory] = useState<ProductCategory>(initial?.category ?? 'Zenchang')
  const [estimatedValue, setEstimatedValue] = useState(initial ? String(initial.estimatedValue) : '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [alamat, setAlamat] = useState(initial?.alamat ?? '')

  const isNewCustomer = customerId === NEW_CUSTOMER_VALUE

  const handleSave = async () => {
    setSubmitted(true)
    if (!name.trim() || !user || !salesPic) return
    if (isNewCustomer && !newCustomerName.trim()) return
    if (!estimatedValue || Number(estimatedValue) <= 0) return
    setSaving(true)
    try {
      if (initial) {
        const updatedCustomerName = isNewCustomer ? newCustomerName : (customers.find((c) => c.id === customerId)?.name ?? initial.customerName ?? '')
        await updateDocument('projects', initial.id, {
          name,
          category,
          estimatedValue: Number(estimatedValue) || 0,
          salesPic,
          phone,
          alamat,
          customerName: updatedCustomerName,
        })
        // Sync alamat → lokasi dan customerName ke semua installation project ini
        const installs = await getDocuments('installations', [where('projectId', '==', initial.id)])
        await Promise.all(installs.map((inst) => updateDocument('installations', inst.id as string, { lokasi: alamat, customerName: updatedCustomerName })))
      } else {
        let finalCustomerId = customerId
        let finalCustomerName = customers.find((c) => c.id === customerId)?.name ?? ''
        if (isNewCustomer) {
          finalCustomerName = newCustomerName
          finalCustomerId = await createDoc('customers', {
            name: newCustomerName,
            phone: '',
            email: '',
            source: 'offline',
            status: 'prospect',
            isActive: true,
            lastFollowUp: new Date(),
            createdBy: user.id,
          })
        }
        const projectId = await createDoc('projects', {
          name,
          customerId: finalCustomerId,
          customerName: finalCustomerName,
          salesPic,
          category,
          status: 'active',
          pipelineStage: 'leads',
          estimatedValue: Number(estimatedValue) || 0,
          dpPercentage: 0,
          payments: [],
          meetingNotes: [],
          phone,
          alamat,
        })
        await notifyProjectSalesCreated(salesPic, name, projectId)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Project' : 'Tambah Project Baru'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nama Project</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Mis. Mesin Sortir PMX-300" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Customer</label>
            {initial ? (
              <input value={initial.customerName} disabled className="w-full px-3 py-2 border border-input rounded-md text-sm bg-muted text-muted-foreground" />
            ) : (
              <>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  <option value={NEW_CUSTOMER_VALUE}>+ Customer Baru</option>
                </select>
                {isNewCustomer && (
                  <input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} className="w-full mt-2 px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Nama customer baru" />
                )}
              </>
            )}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">PIC Sales</label>
            <select value={salesPic} onChange={(e) => setSalesPic(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {salesUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Brand Mesin</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(['Zenchang','VNT','Nordic','Zenyer','Lijun','Pinecone'] as ProductCategory[]).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Estimasi Nilai (Rp) <span className="text-red-500">*</span></label>
              <input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} className={`w-full px-3 py-2 border ${err(submitted && (!estimatedValue || Number(estimatedValue) <= 0))} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`} placeholder="0" />
              {submitted && (!estimatedValue || Number(estimatedValue) <= 0) && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">No. HP Customer</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="08xxxxxxxxxx"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Alamat Customer</label>
            <textarea
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Alamat lengkap customer..."
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

const STAGE_GUIDE: Partial<Record<PipelineStage, string>> = {
  leads:              'Proyek baru masuk. Lanjutkan setelah pembayaran DP & request gambar disiapkan.',
  dp_layout:          'Menunggu pembayaran DP & request gambar selesai. Tahap berikutnya otomatis saat keduanya selesai.',
  meeting_fabrikasi:  'Jadwalkan & laksanakan meeting dengan tim Fabrikasi. Catat hasil meeting di bawah, lalu tandai selesai.',
  fabrikasi_build:    'Produk sedang dibuat. Pantau progress melalui Gantt Chart. Tandai selesai setelah QC & FAT.',
  pelunasan:          'Menunggu pelunasan dari customer. Proses melalui Payment Tracking.',
  pengiriman:         'Produk siap dikirim. Proses pengiriman melalui menu Pengiriman.',
  instalasi:          'Produk sudah dikirim. Proses instalasi melalui menu Instalasi.',
}

// Stages that are normally advanced automatically by the system
const AUTO_STAGES: PipelineStage[] = ['dp_layout', 'pengiriman']

interface TrackModalProps {
  project: Project
  onClose: () => void
}

function TrackModal({ project, onClose }: TrackModalProps) {
  const { user }   = useAuthStore()
  const navigate   = useNavigate()
  const [updating, setUpdating]       = useState(false)
  const [savedStage, setSavedStage]   = useState<PipelineStage | null>(null)
  const [showManual, setShowManual]   = useState(false)
  const [noteDate, setNoteDate]       = useState(new Date().toISOString().slice(0, 10))
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote]   = useState(false)

  const currentIdx = STAGES.indexOf(project.pipelineStage)
  const nextStage   = STAGES[currentIdx + 1] as PipelineStage | undefined
  const isLastStage = currentIdx === STAGES.length - 1

  const setStage = async (stage: PipelineStage) => {
    if (stage === project.pipelineStage) return
    setUpdating(true)
    setSavedStage(null)
    try {
      await updateDocument('projects', project.id, { pipelineStage: stage })

      // Saat stage masuk 'instalasi', auto-create Installation jika belum ada
      if (stage === 'instalasi') {
        const existing = await getDocuments('installations', [where('projectId', '==', project.id)])
        if (existing.length === 0) {
          await createDoc('installations', {
            projectId:         project.id,
            projectName:       project.name,
            customerName:      project.customerName ?? '',
            picInstalasi:      '',
            installationDate:  new Date(),
            estimatedDuration: '',
            deadline:          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            lokasi:            project.alamat ?? '',
            notes:             '',
            status:            'pending',
            createdBy:         user?.id ?? '',
          })
        }
      }

      setSavedStage(stage)
    } finally {
      setUpdating(false)
    }
  }

  const addMeetingNote = async () => {
    if (!noteContent.trim()) return
    setSavingNote(true)
    try {
      const newNote: MeetingNote = { date: new Date(noteDate), notes: noteContent }
      const updated = [...(project.meetingNotes ?? []), newNote]
      await updateDocument('projects', project.id, { meetingNotes: updated })
      setNoteContent('')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto space-y-4">

        {/* Header */}
        <div>
          <h3 className="font-semibold">{project.name}</h3>
          <p className="text-sm text-muted-foreground">{project.customerName}</p>
        </div>

        {/* Current stage highlight */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
            {currentIdx + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground">Tahap Saat Ini</p>
            <p className="font-semibold text-sm">{STAGE_LABELS[project.pipelineStage]}</p>
            {STAGE_GUIDE[project.pipelineStage] && (
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{STAGE_GUIDE[project.pipelineStage]}</p>
            )}
          </div>
          {savedStage && (
            <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
              ✓ Tersimpan
            </span>
          )}
        </div>

        {/* Primary action: advance to next stage */}
        {!isLastStage && nextStage && !AUTO_STAGES.includes(nextStage) && (
          <button
            onClick={() => setStage(nextStage)}
            disabled={updating}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {updating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4" />
                Selesaikan & Lanjut ke {STAGE_LABELS[nextStage]}
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </button>
        )}

        {/* Gantt shortcut for fabrikasi_build */}
        {project.pipelineStage === 'fabrikasi_build' && (
          <button
            onClick={() => navigate('/gantt', { state: { projectId: project.id } })}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-primary/30 text-primary rounded-xl text-sm hover:bg-primary/5 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Buka Project Fabrikasi (Gantt Chart)
          </button>
        )}

        {/* Meeting notes for meeting_fabrikasi */}
        {project.pipelineStage === 'meeting_fabrikasi' && (
          <div className="border border-border rounded-xl p-3.5 space-y-2.5">
            <h4 className="text-sm font-medium">Catatan Hasil Meeting</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {(project.meetingNotes ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Belum ada catatan meeting.</p>
              )}
              {(project.meetingNotes ?? []).map((n, i) => (
                <div key={i} className="p-2.5 bg-muted rounded-lg text-sm">
                  <p className="text-[10px] text-muted-foreground mb-0.5">{format(new Date(n.date), 'd MMMM yyyy', { locale: localeId })}</p>
                  <p className="text-sm">{n.notes}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)}
                className="px-2 py-1.5 border border-input rounded-md text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
              <input value={noteContent} onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Hasil meeting..."
                className="flex-1 px-2 py-1.5 border border-input rounded-md text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
              <button onClick={addMeetingNote} disabled={savingNote || !noteContent.trim()}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs disabled:opacity-50">
                {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Tambah'}
              </button>
            </div>
          </div>
        )}

        {/* Stage stepper (manual override) */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowManual((v) => !v)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <span>Ubah Tahap Secara Manual</span>
            {showManual ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showManual && (
            <div className="border-t border-border p-2 space-y-1">
              {STAGES.map((stage, idx) => (
                <button
                  key={stage}
                  onClick={() => setStage(stage)}
                  disabled={updating || stage === project.pipelineStage}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                    stage === project.pipelineStage
                      ? 'bg-primary/10 text-primary font-medium cursor-default'
                      : 'hover:bg-muted/50 text-muted-foreground disabled:opacity-40'
                  )}
                >
                  <span className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-semibold',
                    idx < currentIdx ? 'bg-green-500 text-white' :
                    idx === currentIdx ? 'bg-primary text-primary-foreground' :
                    'border border-border bg-background'
                  )}>
                    {idx < currentIdx ? <Check className="h-3 w-3" /> : idx + 1}
                  </span>
                  <span className="flex-1">{STAGE_LABELS[stage]}</span>
                  {stage === project.pipelineStage && (
                    <span className="text-[10px] text-primary font-medium">Saat ini</span>
                  )}
                  {AUTO_STAGES.includes(stage) && stage !== project.pipelineStage && (
                    <span className="text-[10px] text-muted-foreground">otomatis</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={onClose} className="w-full py-2 border border-border rounded-xl text-sm hover:bg-accent transition-colors">
          Tutup
        </button>
      </div>
    </div>
  )
}

export function PipelinePage() {
  const [items, setItems] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editProject, setEditProject] = useState<Project | undefined>()
  const [trackProject, setTrackProject] = useState<Project | undefined>()
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState<PipelineStage | 'all'>('all')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubP = subscribeToCollection('projects', [], (docs) => {
      setItems(
        docs.map((d) => ({
          ...d,
          meetingNotes: ((d.meetingNotes as MeetingNote[]) ?? []).map((n) => ({ ...n, date: toDate(n.date as never) ?? new Date() })),
        })) as unknown as Project[]
      )
    })
    const unsubC = subscribeToCollection('customers', [], (docs) => setCustomers(docs as unknown as Customer[]))
    const unsubS = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => setSalesUsers(docs as unknown as User[]))
    return () => { unsubP(); unsubC(); unsubS() }
  }, [])

  // keep trackProject in sync with live data
  useEffect(() => {
    if (!trackProject) return
    const fresh = items.find((i) => i.id === trackProject.id)
    if (fresh) setTrackProject(fresh)
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('projects', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = items.filter((item) => {
    const q = search.toLowerCase()
    const matchSearch = item.name.toLowerCase().includes(q) || (item.customerName ?? '').toLowerCase().includes(q)
    const matchStage = filterStage === 'all' || item.pipelineStage === filterStage
    return matchSearch && matchStage
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Project Sales</h1>
          <p className="text-sm text-muted-foreground">Tracking progress per stage dari leads ke instalasi</p>
        </div>
        <button onClick={() => { setEditProject(undefined); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Tambah Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari nama project atau customer..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStage}
          onChange={(e) => { setFilterStage(e.target.value as PipelineStage | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Tahap</option>
          {STAGES.map((s) => (<option key={s} value={s}>{STAGE_LABELS[s]}</option>))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Pipeline Value', value: currency(items.reduce((s, i) => s + i.estimatedValue, 0)), sub: `${items.length} project aktif` },
          { label: 'Sudah Pelunasan', value: currency(items.filter(i => ['pelunasan','pengiriman','instalasi'].includes(i.pipelineStage)).reduce((s, i) => s + i.estimatedValue, 0)), sub: `${items.filter(i => ['pelunasan','pengiriman','instalasi'].includes(i.pipelineStage)).length} project` },
          { label: 'Dalam Produksi', value: currency(items.filter(i => i.pipelineStage === 'fabrikasi_build').reduce((s, i) => s + i.estimatedValue, 0)), sub: `${items.filter(i => i.pipelineStage === 'fabrikasi_build').length} project` },
        ].map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-xl font-bold mt-1">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Nama Project</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">No. HP</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Alamat</th>
                <th className="text-left p-3 font-medium text-muted-foreground">PIC Sales</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Brand</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estimasi Nilai</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Tahap</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="p-3 font-medium">{item.name}</td>
                  <td className="p-3 text-muted-foreground">{item.customerName}</td>
                  <td className="p-3 text-muted-foreground text-xs">{item.phone || '-'}</td>
                  <td className="p-3 text-muted-foreground text-xs max-w-[160px]">
                    <span className="line-clamp-2">{item.alamat || '-'}</span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{salesUsers.find((u) => u.id === item.salesPic)?.name ?? '-'}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">{item.category}</span></td>
                  <td className="p-3 font-semibold">{currency(item.estimatedValue)}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full whitespace-nowrap">{STAGE_LABELS[item.pipelineStage]}</span></td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setTrackProject(item)} className="text-xs text-primary hover:underline">Track</button>
                      <button onClick={() => { setEditProject(item); setShowForm(true) }} title="Edit" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDeleteTarget(item)} className="text-muted-foreground hover:text-destructive" title="Hapus">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Belum ada project</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <ProjectForm customers={customers} salesUsers={salesUsers} initial={editProject} onClose={() => { setShowForm(false); setEditProject(undefined) }} />
      )}
      {trackProject && (
        <TrackModal project={trackProject} onClose={() => setTrackProject(undefined)} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus project "${deleteTarget.name}"?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
