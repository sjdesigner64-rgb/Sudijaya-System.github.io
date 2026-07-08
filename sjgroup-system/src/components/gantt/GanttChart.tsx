import { useState } from 'react'
import { format, addDays, differenceInDays, startOfDay } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Plus, StickyNote, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { GanttTask, GanttTaskName, GanttTaskStatus } from '@/types'

const TASK_LABELS: Record<GanttTaskName, string> = {
  drawing: 'Drawing',
  purchase_material: 'Purchase Material',
  cutting_laser: 'Cutting Laser',
  vendor: 'Vendor',
  fabrikasi: 'Fabrikasi',
  electrical: 'Electrical',
  qc_fat: 'QC & FAT',
  instalasi: 'Instalasi',
}

const STATUS_COLORS: Record<GanttTaskStatus, string> = {
  pending: 'bg-gray-300 dark:bg-gray-600',
  in_progress: 'bg-blue-500',
  done: 'bg-green-500',
  delayed: 'bg-red-500',
}

const STATUS_LABELS: Record<GanttTaskStatus, string> = {
  pending: 'Belum Mulai',
  in_progress: 'On Progress',
  done: 'Selesai',
  delayed: 'Terlambat',
}

interface NoteModalProps {
  task: GanttTask
  date: Date
  onClose: () => void
  onSave: (taskId: string, date: Date, content: string) => void
  canEdit: boolean
}

function NoteModal({ task, date, onClose, onSave, canEdit }: NoteModalProps) {
  const existing = task.notes.find(
    (n) => format(new Date(n.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
  )
  const [content, setContent] = useState(existing?.content ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm p-4">
        <h3 className="font-semibold mb-1">{TASK_LABELS[task.taskName]}</h3>
        <p className="text-sm text-muted-foreground mb-3">
          {format(date, 'd MMMM yyyy', { locale: localeId })}
        </p>
        {canEdit ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tambah catatan untuk tanggal ini..."
            className="w-full p-2 border border-input rounded-md text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          />
        ) : (
          existing && <div className="mb-3 p-2.5 bg-muted rounded-lg text-sm">{existing.content}</div>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          {canEdit && (
            <button
              onClick={() => { onSave(task.id, date, content); onClose() }}
              disabled={!content.trim()}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
            >
              Simpan
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface GanttChartProps {
  tasks: GanttTask[]
  projectName: string
  overallDeadline: Date
  canEdit?: boolean
  onStatusChange?: (taskId: string, status: GanttTaskStatus) => void
  onAddNote?: (taskId: string, date: Date, content: string) => void
  onDeadlineChange?: (taskId: string, date: Date) => void
  onStartDateChange?: (taskId: string, date: Date) => void
}

// Parse 'yyyy-MM-dd' string ke local Date (bukan UTC midnight)
const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Format Date ke 'yyyy-MM-dd' pakai local timezone
const formatDateInput = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function GanttChart({
  tasks,
  projectName,
  overallDeadline,
  canEdit = false,
  onStatusChange,
  onAddNote,
  onDeadlineChange,
  onStartDateChange,
}: GanttChartProps) {
  const today = startOfDay(new Date())
  const [viewStart, setViewStart] = useState(today)
  const DAYS_SHOWN = 14
  const [noteModal, setNoteModal] = useState<{ task: GanttTask; date: Date } | null>(null)
  // State editing: { id: taskId, value: 'yyyy-MM-dd' } — onChange hanya update value, onBlur yg simpan
  const [editingStart, setEditingStart] = useState<{ id: string; value: string } | null>(null)
  const [editingDeadline, setEditingDeadline] = useState<{ id: string; value: string } | null>(null)

  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(viewStart, i))

  const getBarStyle = (task: GanttTask) => {
    if (!task.startDate || !task.deadline) return null
    const start = startOfDay(new Date(task.startDate))
    const end = startOfDay(new Date(task.deadline))
    const offsetDays = differenceInDays(start, viewStart)
    const durationDays = differenceInDays(end, start) + 1
    if (offsetDays >= DAYS_SHOWN || offsetDays + durationDays <= 0) return null
    const clampedOffset = Math.max(0, offsetDays)
    const clampedDuration = Math.min(DAYS_SHOWN - clampedOffset, durationDays - (clampedOffset - offsetDays))
    return {
      left: `${(clampedOffset / DAYS_SHOWN) * 100}%`,
      width: `${(clampedDuration / DAYS_SHOWN) * 100}%`,
    }
  }

  const hasNote = (task: GanttTask, date: Date) =>
    task.notes.some(
      (n) => format(new Date(n.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{projectName}</h2>
          <p className="text-sm text-muted-foreground">
            Deadline: {format(overallDeadline, 'd MMMM yyyy', { locale: localeId })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewStart((d) => addDays(d, -7))}
            className="p-1.5 border border-border rounded-md hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            {format(viewStart, 'd MMM', { locale: localeId })} – {format(addDays(viewStart, DAYS_SHOWN - 1), 'd MMM yyyy', { locale: localeId })}
          </span>
          <button
            onClick={() => setViewStart((d) => addDays(d, 7))}
            className="p-1.5 border border-border rounded-md hover:bg-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {(Object.entries(STATUS_LABELS) as [GanttTaskStatus, string][]).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn('w-3 h-3 rounded-sm', STATUS_COLORS[status])} />
            {label}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 bg-muted/50 text-left p-3 font-medium w-36 min-w-[144px] border-b border-r border-border">
                Task
              </th>
              <th className="p-3 font-medium border-b border-r border-border w-24">Mulai</th>
              <th className="p-3 font-medium border-b border-r border-border w-24">Deadline</th>
              <th className="p-3 font-medium border-b border-r border-border w-24">Status</th>
              <th className="p-3 font-medium border-b border-border" colSpan={DAYS_SHOWN}>
                <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${DAYS_SHOWN}, minmax(0, 1fr))` }}>
                  {days.map((d) => (
                    <div
                      key={d.toISOString()}
                      className={cn(
                        'text-center text-xs py-0.5 rounded',
                        format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                          && 'bg-primary text-primary-foreground'
                      )}
                    >
                      <span className="block font-normal text-muted-foreground">{format(d, 'EEE', { locale: localeId })}</span>
                      {format(d, 'd')}
                    </div>
                  ))}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const barStyle = getBarStyle(task)
              return (
                <tr key={task.id} className="border-b border-border hover:bg-muted/20">
                  {/* Task name */}
                  <td className="sticky left-0 bg-card border-r border-border p-3 font-medium">
                    {TASK_LABELS[task.taskName]}
                  </td>

                  {/* Tanggal Mulai */}
                  <td className="border-r border-border p-3 text-muted-foreground text-xs">
                    {canEdit && editingStart?.id === task.id ? (
                      <input
                        type="date"
                        autoFocus
                        value={editingStart.value}
                        onChange={(e) => setEditingStart({ id: task.id, value: e.target.value })}
                        onBlur={() => {
                          if (editingStart.value) onStartDateChange?.(task.id, parseLocalDate(editingStart.value))
                          setEditingStart(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingStart(null)
                        }}
                        className="w-full px-1 py-0.5 border border-input rounded text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    ) : (
                      <button
                        onClick={() => canEdit && setEditingStart({
                          id: task.id,
                          value: task.startDate ? formatDateInput(new Date(task.startDate)) : '',
                        })}
                        disabled={!canEdit}
                        className={cn('text-left', canEdit && 'hover:text-primary hover:underline')}
                        title={canEdit ? 'Klik untuk ubah tanggal mulai' : undefined}
                      >
                        {task.startDate ? format(new Date(task.startDate), 'dd/MM/yy') : (canEdit ? 'Set tanggal' : '-')}
                      </button>
                    )}
                  </td>

                  {/* Deadline */}
                  <td className="border-r border-border p-3 text-muted-foreground text-xs">
                    {canEdit && editingDeadline?.id === task.id ? (
                      <input
                        type="date"
                        autoFocus
                        value={editingDeadline.value}
                        onChange={(e) => setEditingDeadline({ id: task.id, value: e.target.value })}
                        onBlur={() => {
                          if (editingDeadline.value) onDeadlineChange?.(task.id, parseLocalDate(editingDeadline.value))
                          setEditingDeadline(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingDeadline(null)
                        }}
                        className="w-full px-1 py-0.5 border border-input rounded text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    ) : (
                      <button
                        onClick={() => canEdit && setEditingDeadline({
                          id: task.id,
                          value: task.deadline ? formatDateInput(new Date(task.deadline)) : '',
                        })}
                        disabled={!canEdit}
                        className={cn('text-left', canEdit && 'hover:text-primary hover:underline')}
                        title={canEdit ? 'Klik untuk ubah deadline' : undefined}
                      >
                        {task.deadline ? format(new Date(task.deadline), 'dd/MM/yy') : '-'}
                      </button>
                    )}
                  </td>

                  {/* Status */}
                  <td className="border-r border-border p-3">
                    {canEdit ? (
                      <select
                        value={task.status}
                        onChange={(e) => onStatusChange?.(task.id, e.target.value as GanttTaskStatus)}
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded border-0 cursor-pointer bg-transparent',
                          task.status === 'done' && 'text-green-600',
                          task.status === 'in_progress' && 'text-blue-600',
                          task.status === 'delayed' && 'text-red-600',
                        )}
                      >
                        {(Object.entries(STATUS_LABELS) as [GanttTaskStatus, string][]).map(([s, l]) => (
                          <option key={s} value={s}>{l}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full',
                        task.status === 'done' && 'bg-green-100 dark:bg-green-900 text-green-700',
                        task.status === 'in_progress' && 'bg-blue-100 dark:bg-blue-900 text-blue-700',
                        task.status === 'delayed' && 'bg-red-100 dark:bg-red-900 text-red-700',
                        task.status === 'pending' && 'bg-gray-100 dark:bg-gray-800 text-gray-700',
                      )}>
                        {STATUS_LABELS[task.status]}
                      </span>
                    )}
                  </td>

                  {/* Calendar cells */}
                  <td colSpan={DAYS_SHOWN} className="p-0 relative h-12">
                    {/* Bar */}
                    {barStyle && (
                      <div
                        className={cn('absolute top-2 h-6 rounded opacity-80', STATUS_COLORS[task.status])}
                        style={{ left: barStyle.left, width: barStyle.width }}
                      />
                    )}
                    {/* Note buttons */}
                    <div
                      className="grid h-full"
                      style={{ gridTemplateColumns: `repeat(${DAYS_SHOWN}, minmax(0, 1fr))` }}
                    >
                      {days.map((d) => {
                        const noted = hasNote(task, d)
                        return (
                          <div
                            key={d.toISOString()}
                            className={cn(
                              'relative border-r border-border/30 flex items-end justify-center pb-0.5',
                              format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') && 'bg-primary/5'
                            )}
                          >
                            <button
                              onClick={() => setNoteModal({ task, date: d })}
                              className={cn(
                                'w-4 h-4 rounded flex items-center justify-center transition-opacity',
                                noted ? 'opacity-100 text-amber-500' : 'opacity-0 hover:opacity-60 text-muted-foreground'
                              )}
                              title="Catatan"
                            >
                              <StickyNote className="h-3 w-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Note modal */}
      {noteModal && (
        <NoteModal
          task={noteModal.task}
          date={noteModal.date}
          canEdit={canEdit}
          onClose={() => setNoteModal(null)}
          onSave={(taskId, date, content) => onAddNote?.(taskId, date, content)}
        />
      )}
    </div>
  )
}
