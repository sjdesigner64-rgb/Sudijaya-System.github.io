import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, Search, MapPin, CalendarDays, AlertTriangle, CheckCircle2, Clock, Pencil } from 'lucide-react'
import { cn } from '@/utils/cn'
import { format, differenceInDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import type { Installation, InstallationStatus, Project, User } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const STATUS_LABELS: Record<InstallationStatus, string> = {
  pending:     'Pending',
  dijadwalkan: 'Dijadwalkan',
  reschedule:  'Reschedule',
  selesai:     'Selesai',
}
const STATUS_COLORS: Record<InstallationStatus, string> = {
  pending:     'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  dijadwalkan: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  reschedule:  'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
  selesai:     'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
}

const toDateInput = (d?: Date) => (d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '')

function deadlineInfo(deadline: Date, status: InstallationStatus) {
  if (status === 'selesai') return { label: 'Selesai', cls: 'text-green-600 dark:text-green-400' }
  const days = differenceInDays(deadline, new Date())
  if (days < 0)   return { label: `Terlambat ${Math.abs(days)}h`, cls: 'text-red-600 dark:text-red-400 font-semibold' }
  if (days === 0) return { label: 'Hari ini', cls: 'text-red-500 dark:text-red-400 font-semibold' }
  if (days <= 3)  return { label: `${days} hari lagi`, cls: 'text-amber-600 dark:text-amber-400 font-semibold' }
  return { label: `${days} hari lagi`, cls: 'text-muted-foreground' }
}

// ─── Form ──────────────────────────────────────────────────────────────────────
interface InstallationFormProps {
  projects: Project[]
  fabrikasiUsers: User[]
  initial?: Installation
  onClose: () => void
}

function InstallationForm({ projects, fabrikasiUsers, initial, onClose }: InstallationFormProps) {
  const { user }  = useAuthStore()
  const isAdmin   = user?.role === 'admin' || user?.role === 'super_admin'
  const [saving, setSaving]                       = useState(false)
  const [submitted, setSubmitted]                 = useState(false)
  const [projectId, setProjectId]                 = useState(initial?.projectId ?? projects[0]?.id ?? '')
  const [picInstalasi, setPicInstalasi]           = useState(initial?.picInstalasi ?? '')
  const [installationDate, setInstallationDate]   = useState(toDateInput(initial?.installationDate) || new Date().toISOString().slice(0, 10))
  const [estimatedDuration, setEstimatedDuration] = useState(initial?.estimatedDuration ?? '')
  const [deadline, setDeadline]                   = useState(toDateInput(initial?.deadline) || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))
  const [lokasi, setLokasi]                       = useState(initial?.lokasi ?? '')
  const [notes, setNotes]                         = useState(initial?.notes ?? '')
  const [status, setStatus]                       = useState<InstallationStatus>(initial?.status ?? 'pending')

  // Sync lokasi & customerName from project whenever project changes (create only)
  useEffect(() => {
    if (initial) return
    const proj = projects.find((p) => p.id === projectId)
    setLokasi(proj?.alamat ?? '')
    // customerName di-set saat handleSave, tapi selectedProject.customerName sudah ter-sync lewat state
  }, [projectId, projects]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProject = projects.find((p) => p.id === projectId)

  const handleSave = async () => {
    setSubmitted(true)
    const needPic = isAdmin && !picInstalasi
    if (!selectedProject || needPic || !installationDate || !deadline || !user) return
    setSaving(true)
    try {
      const data = {
        projectId:         selectedProject.id,
        projectName:       selectedProject.name,
        customerName:      selectedProject.customerName ?? '',
        picInstalasi,
        installationDate:  new Date(installationDate),
        estimatedDuration,
        deadline:          new Date(deadline),
        lokasi:            lokasi.trim(),
        notes:             notes.trim(),
        status,
      }
      if (initial) {
        await updateDocument('installations', initial.id, data)
      } else {
        await createDoc('installations', { ...data, createdBy: user.id })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring'
  const errInp = (invalid: boolean) => cn(inp, invalid && 'border-red-400 dark:border-red-600')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Instalasi' : 'Tambah Jadwal Instalasi'}</h3>

        <div className="space-y-3">
          {/* Project */}
          <div>
            <label className="text-sm font-medium block mb-1">Nama Project <span className="text-red-500">*</span></label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inp} disabled={!!initial}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {selectedProject?.customerName && (
              <p className="text-xs text-muted-foreground mt-0.5">Customer: {selectedProject.customerName}</p>
            )}
          </div>

          {/* PIC — hanya admin yang bisa ubah assignee */}
          <div>
            <label className="text-sm font-medium block mb-1">PIC Instalasi {isAdmin && <span className="text-red-500">*</span>}</label>
            {fabrikasiUsers.length === 0 ? (
              <p className="text-xs text-amber-600">Belum ada user fabrikasi terdaftar.</p>
            ) : isAdmin ? (
              <>
                <select value={picInstalasi} onChange={(e) => setPicInstalasi(e.target.value)}
                  className={errInp(submitted && !picInstalasi)}>
                  <option value="">— Pilih PIC —</option>
                  {fabrikasiUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                {submitted && !picInstalasi && <p className="text-xs text-red-500 mt-0.5">Wajib dipilih</p>}
              </>
            ) : (
              <input
                value={fabrikasiUsers.find((u) => u.id === picInstalasi)?.name ?? picInstalasi}
                disabled
                className={cn(inp, 'bg-muted text-muted-foreground')}
              />
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Tanggal Instalasi</label>
              <input type="date" value={installationDate} onChange={(e) => setInstallationDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Deadline <span className="text-red-500">*</span></label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                className={errInp(submitted && !deadline)} />
              {submitted && !deadline && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
          </div>

          {/* Alamat */}
          <div>
            <label className="text-sm font-medium block mb-1">Alamat</label>
            <input value={lokasi} onChange={(e) => setLokasi(e.target.value)}
              className={inp} placeholder="Alamat lengkap lokasi instalasi..." />
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium block mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as InstallationStatus)} className={inp}>
              {(Object.entries(STATUS_LABELS) as [InstallationStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium block mb-1">Catatan</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className={cn(inp, 'resize-none')}
              placeholder="Catatan tambahan, alasan reschedule, kebutuhan khusus, dsb..." />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">
            Batal
          </button>
          <button onClick={handleSave} disabled={saving || fabrikasiUsers.length === 0}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Inline status select ──────────────────────────────────────────────────────
function InlineStatusSelect({ installation }: { installation: Installation }) {
  const [saving, setSaving] = useState(false)
  const current = installation.status as InstallationStatus

  const handleChange = async (newStatus: InstallationStatus) => {
    if (newStatus === current) return
    setSaving(true)
    try {
      await updateDocument('installations', installation.id, { status: newStatus })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
      <select
        value={current}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as InstallationStatus)}
        className={cn(
          'px-2 py-0.5 text-xs rounded-full border border-transparent cursor-pointer',
          'focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed',
          STATUS_COLORS[current]
        )}
      >
        {(Object.entries(STATUS_LABELS) as [InstallationStatus, string][]).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Notes popover ─────────────────────────────────────────────────────────────
function NotesModal({ installation, onClose }: { installation: Installation; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm p-5">
        <h3 className="font-semibold mb-1">{installation.projectName}</h3>
        <p className="text-xs text-muted-foreground mb-3">{installation.customerName}</p>
        {installation.lokasi && (
          <div className="flex items-start gap-2 mb-3">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm">{installation.lokasi}</p>
          </div>
        )}
        <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap min-h-[60px]">
          {installation.notes || <span className="text-muted-foreground italic">Tidak ada catatan.</span>}
        </div>
        <button onClick={onClose} className="w-full mt-4 py-2 border border-border rounded-md text-sm hover:bg-accent">
          Tutup
        </button>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export function InstallationPage() {
  const { user }                                    = useAuthStore()
  const [installations, setInstallations]           = useState<Installation[]>([])
  const [projects, setProjects]                     = useState<Project[]>([])
  const [fabrikasiUsers, setFabrikasiUsers]         = useState<User[]>([])
  const [salesUsers, setSalesUsers]                 = useState<User[]>([])
  const [showForm, setShowForm]                     = useState(false)
  const [editInstallation, setEditInstallation]     = useState<Installation | undefined>()
  const [notesInstallation, setNotesInstallation]   = useState<Installation | null>(null)
  const [search, setSearch]                         = useState('')
  const [filterStatus, setFilterStatus]             = useState<InstallationStatus | 'all'>('all')
  const [filterPic, setFilterPic]                   = useState('')
  const [page, setPage]                             = useState(1)
  const [deleteTarget, setDeleteTarget]             = useState<Installation | null>(null)
  const [deleting, setDeleting]                     = useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    const uns = [
      subscribeToCollection('installations', [], (docs) =>
        setInstallations(
          docs.map((d) => ({
            ...d,
            installationDate: toDate(d.installationDate as never) ?? new Date(),
            deadline:         toDate(d.deadline as never)         ?? new Date(),
          })) as unknown as Installation[]
        )
      ),
      subscribeToCollection('projects', [], (docs) => setProjects(docs as unknown as Project[])),
      subscribeToCollection('users', [where('role', '==', 'fabrikasi')], (docs) =>
        setFabrikasiUsers(docs as unknown as User[])
      ),
      subscribeToCollection('users', [where('role', '==', 'sales')], (docs) =>
        setSalesUsers(docs as unknown as User[])
      ),
    ]
    return () => uns.forEach((u) => u())
  }, [])

  const picName   = (id: string) => fabrikasiUsers.find((u) => u.id === id)?.name ?? (id ? 'Unknown' : '— Belum diisi —')
  const salesName = (installationId: string) => {
    const install = installations.find((i) => i.id === installationId)
    const proj    = projects.find((p) => p.id === install?.projectId)
    return proj?.salesPic ? (salesUsers.find((u) => u.id === proj.salesPic)?.name ?? '—') : '—'
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('installations', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const visible = isAdmin
    ? installations
    : user?.role === 'sales'
      // Sales: hanya instalasi dari project miliknya (salesPic)
      ? installations.filter((i) => {
          const proj = projects.find((p) => p.id === i.projectId)
          return proj?.salesPic === user.id
        })
      // Fabrikasi: hanya instalasi yang di-assign ke dirinya (picInstalasi)
      : installations.filter((i) => i.picInstalasi === user?.id)

  const filtered = visible.filter((i) => {
    const q = search.toLowerCase()
    const matchSearch = (i.projectName ?? '').toLowerCase().includes(q)
      || (i.customerName ?? '').toLowerCase().includes(q)
      || (i.lokasi ?? '').toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || i.status === filterStatus
    const matchPic    = !filterPic || i.picInstalasi === filterPic
    return matchSearch && matchStatus && matchPic
  })

  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'selesai' && b.status !== 'selesai') return 1
    if (b.status === 'selesai' && a.status !== 'selesai') return -1
    return a.deadline.getTime() - b.deadline.getTime()
  })

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // KPI counts
  const counts = {
    pending:     visible.filter((i) => i.status === 'pending').length,
    dijadwalkan: visible.filter((i) => i.status === 'dijadwalkan').length,
    reschedule:  visible.filter((i) => i.status === 'reschedule').length,
    selesai:     visible.filter((i) => i.status === 'selesai').length,
  }
  const overdueCount = visible.filter((i) =>
    i.status !== 'selesai' && differenceInDays(i.deadline, new Date()) < 0
  ).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Instalasi</h1>
          <p className="text-sm text-muted-foreground">Jadwal instalasi mesin di lokasi customer</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditInstallation(undefined); setShowForm(true) }}
            disabled={projects.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Tambah Instalasi
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'pending',     label: 'Pending',      icon: Clock,         color: 'text-gray-500',   bg: 'bg-gray-50 dark:bg-gray-900',   border: 'border-gray-200 dark:border-gray-700' },
          { key: 'dijadwalkan', label: 'Dijadwalkan',  icon: CalendarDays,  color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950',   border: 'border-blue-200 dark:border-blue-800' },
          { key: 'reschedule',  label: 'Reschedule',   icon: AlertTriangle, color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-200 dark:border-amber-800' },
          { key: 'selesai',     label: 'Selesai',      icon: CheckCircle2,  color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-200 dark:border-green-800' },
        ].map(({ key, label, icon: Icon, color, bg, border }) => (
          <button
            key={key}
            onClick={() => { setFilterStatus(filterStatus === key ? 'all' : key as InstallationStatus); setPage(1) }}
            className={cn('rounded-xl border p-3.5 text-left transition-colors hover:shadow-sm',
              bg, border, filterStatus === key && 'ring-2 ring-primary ring-offset-1')}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Icon className={cn('h-4 w-4', color)} />
              {key === 'pending' && overdueCount > 0 && (
                <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                  {overdueCount} overdue
                </span>
              )}
            </div>
            <p className="text-2xl font-bold leading-none">{counts[key as keyof typeof counts]}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari project, customer, lokasi..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as InstallationStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Status</option>
          {(Object.entries(STATUS_LABELS) as [InstallationStatus, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {isAdmin && fabrikasiUsers.length > 0 && (
          <select
            value={filterPic}
            onChange={(e) => { setFilterPic(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Semua PIC</option>
            {fabrikasiUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Project</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC Sales</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Alamat</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC Instalasi</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Tgl Instalasi</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Deadline</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((i) => {
                const dl = deadlineInfo(i.deadline, i.status)
                const noPic = !i.picInstalasi
                return (
                  <tr key={i.id} className={cn('hover:bg-muted/20', noPic && 'bg-amber-50/30 dark:bg-amber-950/10')}>
                    <td className="p-3 font-medium whitespace-nowrap max-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        {noPic && <span title="PIC belum diisi"><AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" /></span>}
                        <span className="truncate">{i.projectName ?? '—'}</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                      {projects.find((p) => p.id === i.projectId)?.customerName ?? i.customerName ?? '—'}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{salesName(i.id)}</td>
                    <td className="p-3 text-xs max-w-[140px]">
                      {i.lokasi ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{i.lokasi}</span>
                        </span>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {noPic
                        ? <span className="text-amber-600 dark:text-amber-400 font-medium">Belum diisi</span>
                        : picName(i.picInstalasi)
                      }
                    </td>
                    <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                      {format(i.installationDate, 'd MMM yyyy', { locale: localeId })}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div>
                        <p className="text-xs text-muted-foreground">{format(i.deadline, 'd MMM yyyy', { locale: localeId })}</p>
                        <p className={cn('text-[11px] font-medium', dl.cls)}>{dl.label}</p>
                      </div>
                    </td>
                    <td className="p-3">
                      {(isAdmin || i.picInstalasi === user?.id) ? (
                        <InlineStatusSelect installation={i} />
                      ) : (
                        <span className={cn('px-2 py-0.5 text-xs rounded-full whitespace-nowrap', STATUS_COLORS[i.status])}>
                          {STATUS_LABELS[i.status]}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {(i.notes || i.lokasi) && (
                          <button
                            onClick={() => setNotesInstallation(i)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                            title="Lihat catatan"
                          >
                            Catatan
                          </button>
                        )}
                        {/* Edit hanya untuk admin atau PIC yang bersangkutan */}
                        {(isAdmin || i.picInstalasi === user?.id) && (
                          <button
                            onClick={() => { setEditInstallation(i); setShowForm(true) }}
                            title="Edit"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => setDeleteTarget(i)} className="text-muted-foreground hover:text-destructive" title="Hapus">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    {search || filterStatus !== 'all' || filterPic
                      ? 'Tidak ada data yang sesuai filter'
                      : 'Belum ada jadwal instalasi'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <InstallationForm
          projects={projects}
          fabrikasiUsers={fabrikasiUsers}
          initial={editInstallation}
          onClose={() => { setShowForm(false); setEditInstallation(undefined) }}
        />
      )}

      {notesInstallation && (
        <NotesModal installation={notesInstallation} onClose={() => setNotesInstallation(null)} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus jadwal instalasi untuk "${deleteTarget.projectName}"?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
