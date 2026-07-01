import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Loader2, Trash2, ArrowLeft, Search, TrendingUp, Activity, CheckCircle2, AlertTriangle, GanttChart as GanttChartIcon, Pencil } from 'lucide-react'
import { cn } from '@/utils/cn'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { GanttChart } from '@/components/gantt/GanttChart'
import { toDate } from '@/utils/firestore'
import type { ProductionGantt, GanttTask, GanttTaskName, GanttTaskStatus, Project, User, Installation } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { notifyQcFatDone } from '@/services/notification.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const TASK_SEQUENCE: GanttTaskName[] = [
  'drawing', 'purchase_material', 'cutting_laser', 'vendor',
  'fabrikasi', 'electrical', 'qc_fat', 'instalasi',
]

const STATUS_LABELS: Record<ProductionGantt['status'], string> = { active: 'Aktif', completed: 'Selesai' }
const STATUS_COLORS: Record<ProductionGantt['status'], string> = {
  active: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  completed: 'bg-green-100 dark:bg-green-900 text-green-700',
}

function NewGanttForm({ projects, existingIds, onClose }: { projects: Project[]; existingIds: string[]; onClose: () => void }) {
  const availableProjects = projects.filter((p) => !existingIds.includes(p.id))
  const [projectId, setProjectId] = useState(availableProjects[0]?.id ?? '')
  const [overallDeadline, setOverallDeadline] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedProject = availableProjects.find((p) => p.id === projectId)

  const handleCreate = async () => {
    if (!selectedProject || !overallDeadline) return
    setSaving(true)
    try {
      const ganttId = await createDoc('production_gantt', {
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        salesPic: selectedProject.salesPic,
        overallDeadline: new Date(overallDeadline),
        status: 'active',
      })
      await Promise.all(
        TASK_SEQUENCE.map((taskName) =>
          createDoc(`production_gantt/${ganttId}/tasks`, {
            taskName,
            deadline: new Date(overallDeadline),
            status: 'pending',
            pic: [],
            notes: [],
          })
        )
      )
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">Buat Project Fabrikasi Baru</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
              ))}
            </select>
            {availableProjects.length === 0 && <p className="text-xs text-muted-foreground mt-1">Semua project sudah punya Gantt Chart</p>}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Deadline Keseluruhan</label>
            <input type="date" value={overallDeadline} onChange={(e) => setOverallDeadline(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleCreate} disabled={saving || !selectedProject || !overallDeadline} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Buat
          </button>
        </div>
      </div>
    </div>
  )
}

function EditGanttForm({ gantt, onClose }: { gantt: ProductionGantt; onClose: () => void }) {
  const [saving, setSaving] = useState(false)
  const [overallDeadline, setOverallDeadline] = useState(gantt.overallDeadline.toISOString().slice(0, 10))
  const [status, setStatus] = useState<ProductionGantt['status']>(gantt.status)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateDocument('production_gantt', gantt.id, { overallDeadline: new Date(overallDeadline), status })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">Edit Project Fabrikasi</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nama Project</label>
            <input value={gantt.projectName} disabled className="w-full px-3 py-2 border border-input rounded-md text-sm bg-muted text-muted-foreground" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Deadline Keseluruhan</label>
            <input type="date" value={overallDeadline} onChange={(e) => setOverallDeadline(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ProductionGantt['status'])} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="active">Aktif</option>
              <option value="completed">Selesai</option>
            </select>
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

export function GanttPage() {
  const { user } = useAuthStore()
  const location = useLocation()
  const [gantts, setGantts] = useState<ProductionGantt[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editGantt, setEditGantt] = useState<ProductionGantt | undefined>()
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [adminIds, setAdminIds] = useState<string[]>([])
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ProductionGantt['status'] | 'all'>('all')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<ProductionGantt | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [installation, setInstallation] = useState<Installation | null>(null)
  const syncingRef = useRef(false)
  const canEdit = user?.role === 'fabrikasi' || user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    const unsubG = subscribeToCollection('production_gantt', [], (docs) => {
      const mapped = docs.map((d) => ({
        ...d,
        overallDeadline: toDate(d.overallDeadline as never) ?? new Date(),
        tasks: [],
      })) as unknown as ProductionGantt[]
      setGantts(mapped)
    })
    const unsubP = subscribeToCollection('projects', [], (docs) => {
      setProjects(docs as unknown as Project[])
    })
    const unsubS = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => {
      setSalesUsers(docs as unknown as User[])
    })
    const unsubA = subscribeToCollection('users', [where('role', '==', 'admin')], (docs) => {
      setAdminIds((docs as unknown as User[]).map((u) => u.id))
    })
    const unsubM = subscribeToCollection('users', [where('role', '==', 'media')], (docs) => {
      setMediaIds((docs as unknown as User[]).map((u) => u.id))
    })
    return () => { unsubG(); unsubP(); unsubS(); unsubA(); unsubM() }
  }, [])

  // Auto-select gantt when navigated from PipelinePage with a projectId
  useEffect(() => {
    const fromProjectId = (location.state as { projectId?: string } | null)?.projectId
    if (!fromProjectId || !gantts.length || selectedId) return
    const match = gantts.find((g) => g.projectId === fromProjectId)
    if (match) setSelectedId(match.id)
  }, [gantts, location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) {
      setTasks([])
      return
    }
    const unsubscribe = subscribeToCollection(`production_gantt/${selectedId}/tasks`, [], (docs) => {
      const mapped = docs.map((d) => ({
        ...d,
        deadline: toDate(d.deadline as never) ?? new Date(),
        startDate: toDate(d.startDate as never),
        completedDate: toDate(d.completedDate as never),
        notes: ((d.notes as { date: unknown; content: string; createdBy: string }[]) ?? []).map((n) => ({
          ...n,
          date: toDate(n.date as never) ?? new Date(),
        })),
      })) as unknown as GanttTask[]
      mapped.sort((a, b) => TASK_SEQUENCE.indexOf(a.taskName) - TASK_SEQUENCE.indexOf(b.taskName))
      setTasks(mapped)
    })
    return unsubscribe
  }, [selectedId])

  // Subscribe ke data instalasi untuk project yang sedang dipilih
  useEffect(() => {
    const projectId = gantts.find((g) => g.id === selectedId)?.projectId
    if (!projectId) { setInstallation(null); return }
    return subscribeToCollection('installations', [where('projectId', '==', projectId)], (docs) => {
      if (docs.length === 0) { setInstallation(null); return }
      const d = docs[0]
      setInstallation({
        ...d,
        installationDate: toDate(d.installationDate as never) ?? new Date(),
        deadline:         toDate(d.deadline as never)         ?? new Date(),
      } as unknown as Installation)
    })
  }, [selectedId, gantts])

  // Auto-sync task 'instalasi' di Gantt dengan data dari menu Instalasi
  useEffect(() => {
    if (!installation || !selectedId || tasks.length === 0 || syncingRef.current) return
    const instTask = tasks.find((t) => t.taskName === 'instalasi')
    if (!instTask) return

    const newStart    = installation.installationDate
    const newDeadline = installation.deadline

    const startDiff    = !instTask.startDate || Math.abs(instTask.startDate.getTime() - newStart.getTime()) > 60_000
    const deadlineDiff = Math.abs(instTask.deadline.getTime() - newDeadline.getTime()) > 60_000

    if (!startDiff && !deadlineDiff) return

    syncingRef.current = true
    updateDocument(`production_gantt/${selectedId}/tasks`, instTask.id, {
      startDate: newStart,
      deadline:  newDeadline,
    }).finally(() => { syncingRef.current = false })
  }, [installation, tasks, selectedId])

  const selected = gantts.find((g) => g.id === selectedId)

  const handleStatusChange = async (taskId: string, status: GanttTaskStatus) => {
    const task = tasks.find((t) => t.id === taskId)
    await updateDocument(`production_gantt/${selectedId}/tasks`, taskId, { status })
    if (status === 'done' && task?.status !== 'done' && task?.taskName === 'qc_fat' && selected) {
      await notifyQcFatDone(adminIds, mediaIds, selected.projectName, selected.projectId)
    }
  }

  const handleDeadlineChange = async (taskId: string, date: Date) => {
    await updateDocument(`production_gantt/${selectedId}/tasks`, taskId, { deadline: date })
  }

  const handleStartDateChange = async (taskId: string, date: Date) => {
    await updateDocument(`production_gantt/${selectedId}/tasks`, taskId, { startDate: date })
  }

  const handleSaveNote = async (taskId: string, date: Date, content: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const dateKey = date.toDateString()
    const existingIdx = task.notes.findIndex((n) => new Date(n.date).toDateString() === dateKey)
    const newNotes = [...task.notes]
    if (existingIdx >= 0) {
      newNotes[existingIdx] = { ...newNotes[existingIdx], content }
    } else {
      newNotes.push({ date, content, createdBy: user?.id ?? '' })
    }
    await updateDocument(`production_gantt/${selectedId}/tasks`, taskId, { notes: newNotes })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('production_gantt', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const isSales = user?.role === 'sales'

  // visibleGantts: filtered by role only — used for KPI (unaffected by search/status filter)
  const visibleGantts = gantts.filter((g) => !isSales || g.salesPic === user?.id)

  const filteredGantts = visibleGantts.filter((g) => {
    const matchSearch = g.projectName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || g.status === filterStatus
    return matchSearch && matchStatus
  })
  const paginatedGantts = filteredGantts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const now = new Date()
  const overdueCount = visibleGantts.filter((g) => g.status === 'active' && g.overallDeadline < now).length

  // ── Detail view (Gantt Chart) ──────────────────────────────
  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedId('')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke daftar
        </button>
        <GanttChart
          tasks={tasks}
          projectName={selected.projectName}
          overallDeadline={selected.overallDeadline}
          canEdit={canEdit}
          onStatusChange={handleStatusChange}
          onAddNote={handleSaveNote}
          onDeadlineChange={handleDeadlineChange}
          onStartDateChange={handleStartDateChange}
        />
      </div>
    )
  }

  // ── List view (table) ──────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Project Fabrikasi</h1>
          <p className="text-sm text-muted-foreground">Daftar project produksi & Gantt Chart</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Buat Project
          </button>
        )}
      </div>

      {/* KPI Cards */}
      {(() => {
        const cards = [
          {
            label: 'Total Project',
            count: visibleGantts.length,
            icon: <TrendingUp className="h-5 w-5" />,
            color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
            filter: null as ProductionGantt['status'] | 'all' | null,
          },
          {
            label: 'Aktif',
            count: visibleGantts.filter((g) => g.status === 'active').length,
            icon: <Activity className="h-5 w-5" />,
            color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
            filter: 'active' as ProductionGantt['status'] | 'all' | null,
          },
          {
            label: 'Selesai',
            count: visibleGantts.filter((g) => g.status === 'completed').length,
            icon: <CheckCircle2 className="h-5 w-5" />,
            color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
            filter: 'completed' as ProductionGantt['status'] | 'all' | null,
          },
          {
            label: 'Overdue',
            count: overdueCount,
            icon: <AlertTriangle className="h-5 w-5" />,
            color: overdueCount > 0
              ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
              : 'bg-gray-100 dark:bg-gray-800/60 text-gray-400',
            filter: null as ProductionGantt['status'] | 'all' | null,
          },
        ]
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                    <span className="text-2xl font-bold">{c.count}</span>
                  </div>
                  <p className="text-sm font-medium">{c.label}</p>
                  {c.label === 'Overdue' && overdueCount > 0 && (
                    <p className="text-xs text-red-500 mt-0.5">Deadline terlewat</p>
                  )}
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
            placeholder="Cari nama project..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as ProductionGantt['status'] | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="completed">Selesai</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Nama Project</th>
                <th className="text-left p-3 font-medium text-muted-foreground">PIC Sales</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Deadline</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedGantts.map((g) => (
                <tr key={g.id} className="hover:bg-muted/20">
                  <td className="p-3 font-medium">{g.projectName}</td>
                  <td className="p-3 text-muted-foreground text-xs">{salesUsers.find((u) => u.id === g.salesPic)?.name ?? '-'}</td>
                  <td className="p-3 text-muted-foreground text-xs">{format(g.overallDeadline, 'd MMM yyyy', { locale: localeId })}</td>
                  <td className="p-3"><span className={cn('px-2 py-0.5 text-xs rounded-full', STATUS_COLORS[g.status])}>{STATUS_LABELS[g.status]}</span></td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedId(g.id)} title="Track Gantt Chart"
                        className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors">
                        <GanttChartIcon className="h-4 w-4" />
                      </button>
                      {canEdit && (
                        <>
                          <button onClick={() => setEditGantt(g)} title="Edit"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(g)} title="Hapus"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredGantts.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada project fabrikasi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filteredGantts.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && <NewGanttForm projects={projects} existingIds={gantts.map((g) => g.projectId)} onClose={() => setShowForm(false)} />}
      {editGantt && <EditGanttForm gantt={editGantt} onClose={() => setEditGantt(undefined)} />}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus Gantt Chart "${deleteTarget.projectName}"?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
