import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2, Trash2, Check, ExternalLink, Search } from 'lucide-react'
import { cn } from '@/utils/cn'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import type { Project, PipelineStage, ProductCategory, Customer, MeetingNote, User } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
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

function ProjectForm({ customers, salesUsers, initial, onClose }: ProjectFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(initial?.name ?? '')
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.id ?? NEW_CUSTOMER_VALUE)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [salesPic, setSalesPic] = useState(initial?.salesPic ?? user?.id ?? salesUsers[0]?.id ?? '')
  const [category, setCategory] = useState<ProductCategory>(initial?.category ?? 'Zenchang')
  const [estimatedValue, setEstimatedValue] = useState(initial ? String(initial.estimatedValue) : '')

  const isNewCustomer = customerId === NEW_CUSTOMER_VALUE

  const handleSave = async () => {
    if (!name.trim() || !user || !salesPic) return
    if (isNewCustomer && !newCustomerName.trim()) return
    setSaving(true)
    try {
      if (initial) {
        await updateDocument('projects', initial.id, {
          name,
          category,
          estimatedValue: Number(estimatedValue) || 0,
          salesPic,
        })
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
        await createDoc('projects', {
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
        })
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
              <label className="text-sm font-medium block mb-1">Estimasi Nilai (Rp)</label>
              <input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
            </div>
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

interface TrackModalProps {
  project: Project
  onClose: () => void
}

function TrackModal({ project, onClose }: TrackModalProps) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [updating, setUpdating] = useState(false)
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10))
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const currentIdx = STAGES.indexOf(project.pipelineStage)

  const setStage = async (stage: PipelineStage) => {
    setUpdating(true)
    try {
      await updateDocument('projects', project.id, { pipelineStage: stage })
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
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-1">{project.name}</h3>
        <p className="text-sm text-muted-foreground mb-4">{project.customerName}</p>

        {/* Stage stepper */}
        <div className="space-y-1.5 mb-4">
          {STAGES.map((stage, idx) => (
            <button
              key={stage}
              onClick={() => setStage(stage)}
              disabled={updating}
              className={cn(
                'w-full flex items-center gap-3 p-2.5 rounded-lg border text-sm text-left transition-colors',
                stage === project.pipelineStage
                  ? 'border-primary bg-primary/5 font-medium'
                  : idx < currentIdx
                    ? 'border-border text-muted-foreground hover:border-primary/40'
                    : 'border-dashed border-border text-muted-foreground hover:border-primary/40'
              )}
            >
              <span className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0',
                idx <= currentIdx ? 'bg-primary text-primary-foreground' : 'border border-border'
              )}>
                {idx < currentIdx ? <Check className="h-3 w-3" /> : idx + 1}
              </span>
              {STAGE_LABELS[stage]}
            </button>
          ))}
        </div>

        {/* Build Produk -> Gantt Chart shortcut */}
        {project.pipelineStage === 'fabrikasi_build' && (
          <button
            onClick={() => navigate('/gantt')}
            className="w-full flex items-center justify-center gap-2 py-2 mb-4 border border-primary/30 text-primary rounded-md text-sm hover:bg-primary/5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Buka Project Fabrikasi (Gantt Chart)
          </button>
        )}

        {/* Meeting Fabrikasi -> meeting notes */}
        {project.pipelineStage === 'meeting_fabrikasi' && (
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium mb-2">Catatan Hasil Meeting</h4>
            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
              {(project.meetingNotes ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Belum ada catatan meeting.</p>
              )}
              {(project.meetingNotes ?? []).map((n, i) => (
                <div key={i} className="p-2.5 bg-muted rounded-lg text-sm">
                  <p className="text-xs text-muted-foreground mb-0.5">{format(new Date(n.date), 'd MMMM yyyy', { locale: localeId })}</p>
                  <p>{n.notes}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} className="px-2 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
              <input
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Hasil meeting..."
                className="flex-1 px-2 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button onClick={addMeetingNote} disabled={savingNote || !noteContent.trim()} className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Tambah'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Catatan & tanggal bisa ditambahkan lebih dari satu kali sesuai jumlah meeting.</p>
          </div>
        )}

        <button onClick={onClose} className="w-full mt-4 py-2 border border-border rounded-md text-sm hover:bg-accent">Tutup</button>
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
                  <td className="p-3 text-muted-foreground text-xs">{salesUsers.find((u) => u.id === item.salesPic)?.name ?? '-'}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">{item.category}</span></td>
                  <td className="p-3 font-semibold">{currency(item.estimatedValue)}</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full whitespace-nowrap">{STAGE_LABELS[item.pipelineStage]}</span></td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setTrackProject(item)} className="text-xs text-primary hover:underline">Track</button>
                      <button onClick={() => { setEditProject(item); setShowForm(true) }} className="text-xs text-primary hover:underline">Edit</button>
                      <button onClick={() => setDeleteTarget(item)} className="text-muted-foreground hover:text-destructive" title="Hapus">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Belum ada project</td></tr>
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
