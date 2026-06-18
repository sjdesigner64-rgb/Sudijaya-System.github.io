import { useEffect, useState } from 'react'
import { Plus, Upload, Paperclip, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type { DrawingRequest, TaskPriority, TaskStatus, Project, User } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { notifyDrawingRequest } from '@/services/notification.service'

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 dark:bg-gray-800 text-gray-700',
  medium: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  high: 'bg-red-100 dark:bg-red-900 text-red-700',
}
const PRIORITY_LABELS: Record<TaskPriority, string> = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi' }
const STATUS_LABELS: Record<TaskStatus, string> = { pending: 'Pending', in_progress: 'Diproses', done: 'Selesai' }

function RequestForm({ projects, fabrikasiUsers, onClose }: { projects: Project[]; fabrikasiUsers: User[]; onClose: () => void }) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [picIds, setPicIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const selectedProject = projects.find((p) => p.id === projectId)

  const togglePic = (id: string) =>
    setPicIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])

  const handleSubmit = async () => {
    if (!selectedProject || !deadline || picIds.length === 0 || !user) return
    setSaving(true)
    try {
      const requestId = await createDoc('requests_drawing', {
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

      if (files.length > 0) {
        const attachments = await Promise.all(
          files.map(async (f) => {
            const url = await uploadFile(buildPath.drawing(requestId, f.name), f)
            return { url, type: f.type.includes('png') ? 'png' : 'jpg', name: f.name }
          })
        )
        await updateDocument('requests_drawing', requestId, { attachments })
      }

      await notifyDrawingRequest(picIds, selectedProject.name, requestId)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4">Buat Request Gambar</h3>
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
          <div>
            <label className="text-sm font-medium block mb-1">Upload Referensi (JPG/PNG, maks 10MB)</label>
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Drag & drop atau klik untuk upload</span>
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
            Kirim Request
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
  const [showForm, setShowForm] = useState(false)

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
      setFabrikasiUsers(docs as unknown as User[])
    })
    return () => { unsubR(); unsubP(); unsubU() }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Request Gambar</h1>
          <p className="text-sm text-muted-foreground">Request gambar teknis ke tim Fabrikasi</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={projects.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Buat Request
        </button>
      </div>

      {/* Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {requests.map((req) => (
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
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                req.status === 'done' && 'bg-green-100 dark:bg-green-900 text-green-700',
                req.status === 'in_progress' && 'bg-blue-100 dark:bg-blue-900 text-blue-700',
                req.status === 'pending' && 'bg-gray-100 dark:bg-gray-800 text-gray-700',
              )}>
                {STATUS_LABELS[req.status]}
              </span>
              {req.attachments.length > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />{req.attachments.length} file
                </span>
              )}
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            Belum ada request gambar
          </div>
        )}
      </div>

      {showForm && <RequestForm projects={projects} fabrikasiUsers={fabrikasiUsers} onClose={() => setShowForm(false)} />}
    </div>
  )
}
