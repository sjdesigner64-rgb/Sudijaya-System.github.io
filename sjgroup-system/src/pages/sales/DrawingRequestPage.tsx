import { useEffect, useState } from 'react'
import { Plus, Upload, Paperclip, Loader2, Trash2, Download, Search, Pencil, TrendingUp, Clock, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type { DrawingRequest, TaskPriority, TaskStatus, Project, User, Attachment } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { notifyDrawingRequest, notifyMeetingFabrikasi } from '@/services/notification.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 9

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 dark:bg-gray-800 text-gray-700',
  medium: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  high: 'bg-red-100 dark:bg-red-900 text-red-700',
}
const PRIORITY_LABELS: Record<TaskPriority, string> = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi' }
const STATUS_LABELS: Record<TaskStatus, string> = { pending: 'Pending', in_progress: 'Diproses', done: 'Selesai' }

interface RequestFormProps {
  projects: Project[]
  fabrikasiUsers: User[]
  initial?: DrawingRequest
  onClose: () => void
  onDrawingDone?: (project: Project) => void
}

function RequestForm({ projects, fabrikasiUsers, initial, onClose, onDrawingDone }: RequestFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState(initial?.projectId ?? projects[0]?.id ?? '')
  const [deadline, setDeadline] = useState(initial ? initial.deadline.toISOString().slice(0, 10) : '')
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium')
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'pending')
  const [picIds, setPicIds] = useState<string[]>(initial?.assignedTo ?? [])
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [files, setFiles] = useState<File[]>([])

  const selectedProject = projects.find((p) => p.id === projectId)

  const togglePic = (id: string) =>
    setPicIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])

  const handleSubmit = async () => {
    if (!selectedProject || !deadline || picIds.length === 0 || !user) return
    setSaving(true)
    try {
      let requestId = initial?.id ?? ''
      if (initial) {
        await updateDocument('requests_drawing', initial.id, {
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          assignedTo: picIds,
          deadline: new Date(deadline),
          priority,
          status,
          notes,
        })
        // Status baru selesai (done) → cek apakah DP sudah dibayar
        if (status === 'done' && initial.status !== 'done') {
          onDrawingDone?.(selectedProject)
        }
      } else {
        requestId = await createDoc('requests_drawing', {
          projectId: selectedProject.id,
          requestedBy: user.id,
          assignedTo: picIds,
          projectName: selectedProject.name,
          deadline: new Date(deadline),
          priority,
          status: 'pending',
          attachments: [],
          resultAttachments: [],
          notes,
        })
        await notifyDrawingRequest(picIds, selectedProject.name, requestId)
      }

      if (files.length > 0) {
        const newAttachments = await Promise.all(
          files.map(async (f) => {
            const url = await uploadFile(buildPath.drawing(requestId, `${Date.now()}-${f.name}`), f)
            return { url, type: (f.type.includes('png') ? 'png' : 'jpg') as Attachment['type'], name: f.name }
          })
        )
        const existing = initial?.attachments ?? []
        await updateDocument('requests_drawing', requestId, { attachments: [...existing, ...newAttachments] })
      }

      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Request Gambar' : 'Buat Request Gambar'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Deadline</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="low">Rendah</option>
                <option value="medium">Sedang</option>
                <option value="high">Tinggi</option>
              </select>
            </div>
          </div>
          {initial && (
            <div>
              <label className="text-sm font-medium block mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="pending">Pending</option>
                <option value="in_progress">Diproses</option>
                <option value="done">Selesai</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1">PIC Fabrikasi</label>
            <div className="flex flex-wrap gap-2">
              {fabrikasiUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => togglePic(u.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs border transition-colors',
                    picIds.includes(u.id) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground'
                  )}
                >
                  {u.name}
                </button>
              ))}
              {fabrikasiUsers.length === 0 && <p className="text-xs text-muted-foreground">Belum ada user role Fabrikasi</p>}
            </div>
          </div>
          {initial && initial.attachments.length > 0 && (
            <div>
              <label className="text-sm font-medium block mb-1">Gambar Tersimpan</label>
              <ul className="space-y-1">
                {initial.attachments.map((att, i) => (
                  <li key={i}>
                    <a href={att.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />{att.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1">
              {initial ? 'Tambah Gambar (opsional)' : 'Upload Referensi (opsional, JPG/PNG, maks 10MB)'}
            </label>
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Drag & drop atau klik untuk upload (boleh lebih dari satu)</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f) => (
                  <li key={f.name} className="text-xs text-muted-foreground flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />{f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Catatan</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16" placeholder="Catatan untuk fabrikasi..." />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSubmit} disabled={saving || !selectedProject || !deadline || picIds.length === 0} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {initial ? 'Simpan' : 'Kirim Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DrawingRequestPage() {
  const [requests, setRequests] = useState<DrawingRequest[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [fabrikasiUsers, setFabrikasiUsers] = useState<User[]>([])
  const [fabrikasiIds, setFabrikasiIds] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editRequest, setEditRequest] = useState<DrawingRequest | undefined>()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<DrawingRequest | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubR = subscribeToCollection('requests_drawing', [], (docs) => {
      setRequests(
        docs.map((d) => ({ ...d, deadline: toDate(d.deadline as never) ?? new Date() })) as unknown as DrawingRequest[]
      )
    })
    const unsubP = subscribeToCollection('projects', [], (docs) => {
      setProjects(docs as unknown as Project[])
    })
    const unsubU = subscribeToCollection('users', [where('role', '==', 'fabrikasi')], (docs) => {
      const users = docs as unknown as User[]
      setFabrikasiUsers(users)
      setFabrikasiIds(users.map((u) => u.id))
    })
    return () => { unsubR(); unsubP(); unsubU() }
  }, [])

  // Ketika drawing request selesai, cek apakah DP sudah dibayar → maju ke meeting_fabrikasi
  const handleDrawingDone = async (project: Project) => {
    if (project.pipelineStage !== 'dp_layout') return
    const dpPaid = project.payments?.some((p) => p.status === 'paid') ?? false
    if (!dpPaid) return
    await updateDocument('projects', project.id, { pipelineStage: 'meeting_fabrikasi' })
    await notifyMeetingFabrikasi(project.salesPic, fabrikasiIds, project.name, project.id)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('requests_drawing', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = requests.filter((req) => {
    const matchSearch = req.projectName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || req.status === filterStatus
    return matchSearch && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Request Gambar</h1>
          <p className="text-sm text-muted-foreground">Request gambar teknis ke tim Fabrikasi</p>
        </div>
        <button
          onClick={() => { setEditRequest(undefined); setShowForm(true) }}
          disabled={projects.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Buat Request
        </button>
      </div>

      {/* KPI Cards */}
      {(() => {
        const highUrgent = requests.filter((r) => r.priority === 'high' && r.status !== 'done').length
        const cards = [
          {
            label: 'Total Request',
            count: requests.length,
            icon: <TrendingUp className="h-5 w-5" />,
            color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
            filter: null as TaskStatus | 'all' | null,
          },
          {
            label: 'Pending',
            count: requests.filter((r) => r.status === 'pending').length,
            icon: <Clock className="h-5 w-5" />,
            color: 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400',
            filter: 'pending' as TaskStatus | 'all' | null,
          },
          {
            label: 'Diproses',
            count: requests.filter((r) => r.status === 'in_progress').length,
            icon: <RefreshCw className="h-5 w-5" />,
            color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
            filter: 'in_progress' as TaskStatus | 'all' | null,
          },
          {
            label: 'Selesai',
            count: requests.filter((r) => r.status === 'done').length,
            icon: <CheckCircle2 className="h-5 w-5" />,
            color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
            filter: 'done' as TaskStatus | 'all' | null,
          },
        ]
        return (
          <>
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
                  </button>
                )
              })}
            </div>
            {highUrgent > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span><span className="font-semibold">{highUrgent}</span> request prioritas Tinggi belum selesai</span>
              </div>
            )}
          </>
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
          onChange={(e) => { setFilterStatus(e.target.value as TaskStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">Diproses</option>
          <option value="done">Selesai</option>
        </select>
      </div>

      {/* Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginated.map((req) => (
          <div key={req.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-sm">{req.projectName}</h3>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full', PRIORITY_COLORS[req.priority])}>
                {PRIORITY_LABELS[req.priority]}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Deadline: <span className="text-foreground">{format(req.deadline, 'd MMM yyyy', { locale: localeId })}</span></p>
              <p>PIC: <span className="text-foreground">{req.assignedTo.map((id) => fabrikasiUsers.find((u) => u.id === id)?.name ?? id).join(', ')}</span></p>
              {req.notes && <p className="line-clamp-2">{req.notes}</p>}
            </div>
            {req.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {req.attachments.map((att, i) => (
                  <a key={i} href={att.url} target="_blank" rel="noreferrer" download className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Download className="h-3 w-3" />{att.name}
                  </a>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                req.status === 'done' && 'bg-green-100 dark:bg-green-900 text-green-700',
                req.status === 'in_progress' && 'bg-blue-100 dark:bg-blue-900 text-blue-700',
                req.status === 'pending' && 'bg-gray-100 dark:bg-gray-800 text-gray-700',
              )}>
                {STATUS_LABELS[req.status]}
              </span>
              <button onClick={() => { setEditRequest(req); setShowForm(true) }} title="Edit" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => setDeleteTarget(req)} className="text-muted-foreground hover:text-destructive ml-auto" title="Hapus">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            Belum ada request gambar
          </div>
        )}
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <RequestForm
          projects={projects}
          fabrikasiUsers={fabrikasiUsers}
          initial={editRequest}
          onClose={() => { setShowForm(false); setEditRequest(undefined) }}
          onDrawingDone={handleDrawingDone}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus request gambar untuk "${deleteTarget.projectName}"?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
