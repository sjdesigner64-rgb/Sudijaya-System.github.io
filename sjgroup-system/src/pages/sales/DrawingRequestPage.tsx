import { useEffect, useRef, useState } from 'react'
import { Plus, Upload, Paperclip, Loader2, Trash2, Download, Search, Pencil, TrendingUp, Clock, RefreshCw, CheckCircle2, AlertTriangle, FileText } from 'lucide-react'
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
const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-gray-100 dark:bg-gray-800 text-gray-700',
  in_progress: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  done: 'bg-green-100 dark:bg-green-900 text-green-700',
}

// ─── Form Request (Sales & Admin) ─────────────────────────────────────────────
// Sales: hanya bisa isi metadata (project, deadline, PIC, priority, notes) — TIDAK bisa upload
// Admin: bisa isi semua termasuk upload referensi dan update status
function RequestForm({
  projects, fabrikasiUsers, initial, isAdmin, onClose, onDrawingDone,
}: {
  projects: Project[]
  fabrikasiUsers: User[]
  initial?: DrawingRequest
  isAdmin: boolean
  onClose: () => void
  onDrawingDone?: (project: Project) => void
}) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [projectId, setProjectId] = useState(initial?.projectId ?? projects[0]?.id ?? '')
  const [deadline, setDeadline] = useState(
    initial ? (toDate(initial.deadline as never) ?? new Date()).toISOString().slice(0, 10) : ''
  )
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium')
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'pending')
  const [picIds, setPicIds] = useState<string[]>(initial?.assignedTo ?? [])
  const [notes, setNotes] = useState(initial?.notes ?? '')
  // Upload referensi hanya untuk admin/super_admin (bukan sales)
  const [files, setFiles] = useState<File[]>([])

  const selectedProject = projects.find((p) => p.id === projectId)

  const togglePic = (id: string) =>
    setPicIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])

  const handleSubmit = async () => {
    setSubmitted(true)
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
          ...(isAdmin ? { status } : {}),
          notes,
        })
        if (isAdmin && status === 'done' && initial.status !== 'done') {
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

      // Upload referensi (hanya admin yang bisa upload lewat form)
      if (isAdmin && files.length > 0) {
        const newAttachments = await Promise.all(
          files.map(async (f) => {
            const url = await uploadFile(buildPath.drawing(requestId, `ref-${Date.now()}-${f.name}`), f)
            const ext = f.name.split('.').pop()?.toLowerCase()
            const type: Attachment['type'] = ext === 'pdf' ? 'pdf' : ext === 'png' ? 'png' : 'jpg'
            return { url, type, name: f.name }
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
      <div className="bg-card border border-border rounded-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <h3 className="font-semibold">{initial ? 'Edit Request Gambar' : 'Buat Request Gambar'}</h3>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Project <span className="text-red-500">*</span></label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Pilih Project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
              ))}
            </select>
            {submitted && !selectedProject && <p className="text-xs text-red-500 mt-0.5">Wajib pilih project</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Deadline <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {submitted && !deadline && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Prioritas</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">Rendah</option>
                <option value="medium">Sedang</option>
                <option value="high">Tinggi</option>
              </select>
            </div>
          </div>

          {/* Status hanya untuk admin */}
          {initial && isAdmin && (
            <div>
              <label className="text-sm font-medium block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">Diproses</option>
                <option value="done">Selesai</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">PIC Fabrikasi <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2">
              {fabrikasiUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => togglePic(u.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs border transition-colors',
                    picIds.includes(u.id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-foreground'
                  )}
                >
                  {u.name}
                </button>
              ))}
              {fabrikasiUsers.length === 0 && (
                <p className="text-xs text-muted-foreground">Belum ada user role Fabrikasi</p>
              )}
            </div>
            {submitted && picIds.length === 0 && <p className="text-xs text-red-500 mt-0.5">Pilih minimal satu PIC</p>}
          </div>

          {/* Gambar referensi: hanya tampilkan untuk admin */}
          {isAdmin && (
            <>
              {initial && (initial.attachments ?? []).length > 0 && (
                <div>
                  <label className="text-sm font-medium block mb-1">Referensi Tersimpan</label>
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
                  {initial ? 'Tambah Referensi (opsional)' : 'Upload Referensi (opsional)'}
                </label>
                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">JPG / PNG / PDF — boleh lebih dari satu</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  />
                </label>
                {files.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {files.map((f) => (
                      <li key={f.name} className="text-xs text-muted-foreground flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />{f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">Catatan untuk Fabrikasi</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Spesifikasi, ukuran, atau catatan khusus..."
            />
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {initial ? 'Simpan' : 'Kirim Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Upload Hasil Gambar (Fabrikasi saja) ────────────────────────────────────
function FabrikasiResultUpload({ request }: { request: DrawingRequest }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (fileList: FileList) => {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setUploading(true)
    try {
      const newAttachments = await Promise.all(
        files.map(async (f) => {
          const url = await uploadFile(buildPath.drawing(request.id, `hasil-${Date.now()}-${f.name}`), f)
          const ext = f.name.split('.').pop()?.toLowerCase()
          const type: Attachment['type'] = ext === 'pdf' ? 'pdf' : ext === 'png' ? 'png' : 'jpg'
          return { url, type, name: f.name }
        })
      )
      const existing = request.resultAttachments ?? []
      const updates: Record<string, unknown> = { resultAttachments: [...existing, ...newAttachments] }
      // Auto-update status ke in_progress jika masih pending
      if (request.status === 'pending') updates.status = 'in_progress'
      await updateDocument('requests_drawing', request.id, updates)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <label className={cn(
      'inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors',
      uploading
        ? 'text-muted-foreground border-border cursor-not-allowed'
        : 'text-primary border-primary/40 hover:bg-primary/5'
    )}>
      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
      {uploading ? 'Mengupload...' : 'Upload Hasil Gambar'}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        multiple
        className="hidden"
        disabled={uploading}
        onChange={(e) => { if (e.target.files) handleUpload(e.target.files) }}
      />
    </label>
  )
}

// ─── Status Select Inline (Fabrikasi saja) ──────────────────────────────────
function StatusSelectInline({
  request, onDone,
}: {
  request: DrawingRequest
  onDone?: (req: DrawingRequest) => void
}) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (newStatus: TaskStatus) => {
    if (newStatus === request.status || saving) return
    setSaving(true)
    try {
      await updateDocument('requests_drawing', request.id, { status: newStatus })
      if (newStatus === 'done') onDone?.(request)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      <select
        value={request.status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as TaskStatus)}
        className={cn(
          'text-xs px-2 py-0.5 rounded-full border border-transparent cursor-pointer',
          'focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50',
          STATUS_COLORS[request.status],
        )}
      >
        <option value="pending">Pending</option>
        <option value="in_progress">Diproses</option>
        <option value="done">Selesai</option>
      </select>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function DrawingRequestPage() {
  const { user } = useAuthStore()
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

  const isSales = user?.role === 'sales'
  const isFabrikasi = user?.role === 'fabrikasi'
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    const unsubR = subscribeToCollection('requests_drawing', [], (docs) => {
      setRequests(
        docs.map((d) => ({
          ...d,
          deadline: toDate(d.deadline as never) ?? new Date(),
        })) as unknown as DrawingRequest[]
      )
    })
    const unsubP = subscribeToCollection('projects', [], (docs) => setProjects(docs as unknown as Project[]))
    const unsubU = subscribeToCollection('users', [where('role', '==', 'fabrikasi')], (docs) => {
      const users = docs as unknown as User[]
      setFabrikasiUsers(users)
      setFabrikasiIds(users.map((u) => u.id))
    })
    return () => { unsubR(); unsubP(); unsubU() }
  }, [])

  // Ketika status done → cek DP → advance pipeline ke meeting_fabrikasi
  const handleDrawingDone = async (req: DrawingRequest) => {
    const project = projects.find((p) => p.id === req.projectId)
    if (!project || project.pipelineStage !== 'dp_layout') return
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

  // Visibility berdasarkan role
  const visibleRequests = requests.filter((req) => {
    if (isAdmin) return true
    if (isSales) return req.requestedBy === user?.id
    if (isFabrikasi) return (req.assignedTo ?? []).includes(user?.id ?? '')
    return false
  })

  const filtered = visibleRequests.filter((req) => {
    const matchSearch = req.projectName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || req.status === filterStatus
    return matchSearch && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const highUrgent = visibleRequests.filter((r) => r.priority === 'high' && r.status !== 'done').length

  const kpiCards = [
    { label: 'Total', count: visibleRequests.length, icon: <TrendingUp className="h-5 w-5" />, color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600', filter: null as TaskStatus | null },
    { label: 'Pending', count: visibleRequests.filter((r) => r.status === 'pending').length, icon: <Clock className="h-5 w-5" />, color: 'bg-gray-100 dark:bg-gray-800/60 text-gray-600', filter: 'pending' as TaskStatus },
    { label: 'Diproses', count: visibleRequests.filter((r) => r.status === 'in_progress').length, icon: <RefreshCw className="h-5 w-5" />, color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600', filter: 'in_progress' as TaskStatus },
    { label: 'Selesai', count: visibleRequests.filter((r) => r.status === 'done').length, icon: <CheckCircle2 className="h-5 w-5" />, color: 'bg-green-100 dark:bg-green-900/40 text-green-600', filter: 'done' as TaskStatus },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Request Gambar</h1>
          <p className="text-sm text-muted-foreground">
            {isFabrikasi
              ? 'Request gambar yang ditugaskan kepada Anda'
              : 'Request gambar teknis ke tim Fabrikasi'}
          </p>
        </div>
        {/* Tombol buat request: hanya sales & admin */}
        {!isFabrikasi && (
          <button
            onClick={() => { setEditRequest(undefined); setShowForm(true) }}
            disabled={projects.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Buat Request
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((c) => {
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
        {paginated.map((req) => {
          const resultAtts = req.resultAttachments ?? []
          const refAtts = req.attachments ?? []
          const isMyRequest = req.requestedBy === user?.id
          const isAssignedToMe = (req.assignedTo ?? []).includes(user?.id ?? '')

          return (
            <div key={req.id} className="bg-card border border-border rounded-xl p-4 space-y-3 flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-sm leading-snug">{req.projectName}</h3>
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full shrink-0', PRIORITY_COLORS[req.priority])}>
                  {PRIORITY_LABELS[req.priority]}
                </span>
              </div>

              {/* Info */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Deadline: <span className="text-foreground">{format(req.deadline instanceof Date ? req.deadline : new Date(req.deadline as unknown as string), 'd MMM yyyy', { locale: localeId })}</span></p>
                <p>PIC: <span className="text-foreground">{(req.assignedTo ?? []).map((id) => fabrikasiUsers.find((u) => u.id === id)?.name ?? id).join(', ')}</span></p>
                {req.notes && <p className="line-clamp-2">{req.notes}</p>}
              </div>

              {/* Referensi dari Sales (tampil untuk fabrikasi agar tahu spesifikasi) */}
              {refAtts.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Referensi:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {refAtts.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {att.type === 'pdf' ? <FileText className="h-3 w-3" /> : <Paperclip className="h-3 w-3" />}
                        {att.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Hasil Gambar dari Fabrikasi */}
              {resultAtts.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Hasil Gambar:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {resultAtts.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        {att.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1" />

              {/* Footer: aksi berdasarkan role */}
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
                {/* ── Fabrikasi: update status + upload hasil ── */}
                {isFabrikasi && isAssignedToMe && (
                  <>
                    <StatusSelectInline request={req} onDone={handleDrawingDone} />
                    <FabrikasiResultUpload request={req} />
                  </>
                )}

                {/* ── Sales & Admin: status badge + edit + delete ── */}
                {!isFabrikasi && (
                  <>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_COLORS[req.status])}>
                      {STATUS_LABELS[req.status]}
                    </span>

                    {/* Edit: admin bisa edit semua, sales hanya request miliknya */}
                    {(isAdmin || (isSales && isMyRequest)) && (
                      <button
                        onClick={() => { setEditRequest(req); setShowForm(true) }}
                        title="Edit"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Hapus: admin bisa hapus semua, sales hanya miliknya */}
                    {(isAdmin || (isSales && isMyRequest)) && (
                      <button
                        onClick={() => setDeleteTarget(req)}
                        title="Hapus"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors ml-auto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            {isFabrikasi
              ? 'Tidak ada request gambar yang ditugaskan kepada Anda'
              : 'Belum ada request gambar'}
          </div>
        )}
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <RequestForm
          projects={projects}
          fabrikasiUsers={fabrikasiUsers}
          initial={editRequest}
          isAdmin={isAdmin}
          onClose={() => { setShowForm(false); setEditRequest(undefined) }}
          onDrawingDone={(project) => {
            // handleDrawingDone from form (admin only)
            if (project.pipelineStage !== 'dp_layout') return
            const dpPaid = project.payments?.some((p) => p.status === 'paid') ?? false
            if (!dpPaid) return
            updateDocument('projects', project.id, { pipelineStage: 'meeting_fabrikasi' }).then(() =>
              notifyMeetingFabrikasi(project.salesPic, fabrikasiIds, project.name, project.id)
            )
          }}
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
