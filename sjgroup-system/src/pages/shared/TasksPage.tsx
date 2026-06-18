import { useEffect, useState } from 'react'
import { Plus, CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type { Task, TaskStatus, TaskPriority, User } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, subscribeToCollection, where } from '@/services/firestore.service'

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'text-gray-500',
  medium: 'text-amber-500',
  high: 'text-red-500',
}

const STATUS_ICON = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-500" />,
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  pending: 'in_progress',
  in_progress: 'done',
  done: 'pending',
}

function NewTaskForm({ salesUsers, onClose }: { salesUsers: User[]; onClose: () => void }) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState(salesUsers[0]?.id ?? '')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')

  const handleSave = async () => {
    if (!title.trim() || !assignedTo || !dueDate || !user) return
    setSaving(true)
    try {
      await createDoc('tasks', {
        title,
        description,
        assignedTo,
        assignedBy: user.id,
        role: 'sales',
        status: 'pending',
        priority,
        dueDate: new Date(dueDate),
        reminderSent: false,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">Tambah Tugas</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Judul Tugas</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Deskripsi</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Assign ke (Sales)</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Deadline</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
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
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !assignedTo || !dueDate} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function TasksPage() {
  const { user } = useAuthStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')
  const canCreate = user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    const unsubT = subscribeToCollection('tasks', [], (docs) => {
      setTasks(
        docs.map((d) => ({ ...d, dueDate: toDate(d.dueDate as never) ?? new Date() })) as unknown as Task[]
      )
    })
    const unsubU = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => {
      setSalesUsers(docs as unknown as User[])
    })
    return () => { unsubT(); unsubU() }
  }, [])

  const visibleTasks = canCreate ? tasks : tasks.filter((t) => t.assignedTo === user?.id)
  const filtered = visibleTasks.filter((t) => filter === 'all' || t.status === filter)

  const toggleStatus = async (task: Task) => {
    await updateDocument('tasks', task.id, { status: NEXT_STATUS[task.status] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Daily Task</h1>
          <p className="text-sm text-muted-foreground">Tugas harian per departemen</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            disabled={salesUsers.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Tambah Tugas
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['all', 'pending', 'in_progress', 'done'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'px-3 py-2 text-sm border-b-2 transition-colors -mb-px',
              filter === s ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground'
            )}
          >
            {s === 'all' ? 'Semua' : s === 'pending' ? 'Pending' : s === 'in_progress' ? 'Berlangsung' : 'Selesai'}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({visibleTasks.filter((t) => s === 'all' || t.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filtered.map((task) => (
          <div
            key={task.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl border transition-colors',
              task.status === 'done' ? 'border-border opacity-60' : 'border-border hover:border-primary/30'
            )}
          >
            <button onClick={() => toggleStatus(task)} className="mt-0.5 shrink-0">
              {STATUS_ICON[task.status]}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={cn('text-sm font-medium', task.status === 'done' && 'line-through text-muted-foreground')}>
                  {task.title}
                </p>
                {task.priority && (
                  <span className={cn('text-xs shrink-0', PRIORITY_COLORS[task.priority])}>
                    ● {task.priority === 'high' ? 'Tinggi' : task.priority === 'medium' ? 'Sedang' : 'Rendah'}
                  </span>
                )}
              </div>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Due: {format(task.dueDate, 'd MMM yyyy', { locale: localeId })}
              </p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">Tidak ada tugas</div>
        )}
      </div>

      {showForm && <NewTaskForm salesUsers={salesUsers} onClose={() => setShowForm(false)} />}
    </div>
  )
}
