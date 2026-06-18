import { useEffect, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { GanttChart } from '@/components/gantt/GanttChart'
import { toDate } from '@/utils/firestore'
import type { ProductionGantt, GanttTask, GanttTaskName, GanttTaskStatus, Project } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, subscribeToCollection } from '@/services/firestore.service'

const TASK_SEQUENCE: GanttTaskName[] = [
  'drawing', 'purchase_material', 'cutting_laser', 'vendor',
  'fabrikasi', 'electrical', 'qc_fat', 'instalasi',
]

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
        <h3 className="font-semibold mb-4">Buat Project Gantt Baru</h3>
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

export function GanttPage() {
  const { user } = useAuthStore()
  const [gantts, setGantts] = useState<ProductionGantt[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [showForm, setShowForm] = useState(false)
  const canEdit = user?.role === 'fabrikasi' || user?.role === 'super_admin'

  useEffect(() => {
    const unsubG = subscribeToCollection('production_gantt', [], (docs) => {
      const mapped = docs.map((d) => ({
        ...d,
        overallDeadline: toDate(d.overallDeadline as never) ?? new Date(),
        tasks: [],
      })) as unknown as ProductionGantt[]
      setGantts(mapped)
      setSelectedId((prev) => prev || mapped[0]?.id || '')
    })
    const unsubP = subscribeToCollection('projects', [], (docs) => {
      setProjects(docs as unknown as Project[])
    })
    return () => { unsubG(); unsubP() }
  }, [])

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

  const selected = gantts.find((g) => g.id === selectedId)

  const handleStatusChange = async (taskId: string, status: GanttTaskStatus) => {
    await updateDocument(`production_gantt/${selectedId}/tasks`, taskId, { status })
  }

  const handleAddNote = async (taskId: string, date: Date, content: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const newNotes = [...task.notes, { date, content, createdBy: user?.id ?? '' }]
    await updateDocument(`production_gantt/${selectedId}/tasks`, taskId, { notes: newNotes })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Gantt Chart Produksi</h1>
          <p className="text-sm text-muted-foreground">Timeline produksi per project</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Buat Project
          </button>
        )}
      </div>

      {/* Project selector */}
      {gantts.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {gantts.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedId(g.id)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                selectedId === g.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              {g.projectName}
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <GanttChart
          tasks={tasks}
          projectName={selected.projectName}
          overallDeadline={selected.overallDeadline}
          canEdit={canEdit}
          onStatusChange={handleStatusChange}
          onAddNote={handleAddNote}
        />
      ) : (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
          Belum ada project Gantt Chart
        </div>
      )}

      {showForm && <NewGanttForm projects={projects} existingIds={gantts.map((g) => g.projectId)} onClose={() => setShowForm(false)} />}
    </div>
  )
}
