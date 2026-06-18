import { useEffect, useState } from 'react'
import { Plus, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { addMonths } from 'date-fns'
import type { AfterSales, Project } from '@/types'
import { format, differenceInDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import { useAuthStore } from '@/store/authStore'
import { createDoc, subscribeToCollection } from '@/services/firestore.service'

function NewWarrantyForm({ projects, onClose }: { projects: Project[]; onClose: () => void }) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState('12')
  const [notes, setNotes] = useState('')

  const selectedProject = projects.find((p) => p.id === projectId)

  const handleSave = async () => {
    if (!selectedProject || !user) return
    setSaving(true)
    try {
      const start = new Date(startDate)
      const end = addMonths(start, Number(duration))
      await createDoc('after_sales', {
        projectId: selectedProject.id,
        customerId: selectedProject.customerId,
        warrantyStartDate: start,
        warrantyEndDate: end,
        warrantyDurationMonths: Number(duration),
        notes,
        createdBy: user.id,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">Tambah Masa Garansi</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Project / Customer</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Tanggal Mulai</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Durasi (bulan)</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="3">3 bulan</option>
                <option value="6">6 bulan</option>
                <option value="12">12 bulan</option>
                <option value="24">24 bulan</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Catatan</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !selectedProject} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function AfterSalesPage() {
  const [records, setRecords] = useState<AfterSales[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [showForm, setShowForm] = useState(false)
  const today = new Date()

  useEffect(() => {
    const unsubA = subscribeToCollection('after_sales', [], (docs) => {
      setRecords(
        docs.map((d) => ({
          ...d,
          warrantyStartDate: toDate(d.warrantyStartDate as never) ?? new Date(),
          warrantyEndDate: toDate(d.warrantyEndDate as never) ?? new Date(),
        })) as unknown as AfterSales[]
      )
    })
    const unsubP = subscribeToCollection('projects', [], (docs) => {
      setProjects(docs as unknown as Project[])
    })
    return () => { unsubA(); unsubP() }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">After-Sales & Garansi</h1>
          <p className="text-sm text-muted-foreground">Masa garansi per customer setelah pembayaran</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={projects.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Tambah Garansi
        </button>
      </div>

      <div className="space-y-3">
        {records.map((as) => {
          const project = projects.find((p) => p.id === as.projectId)
          const daysLeft = differenceInDays(as.warrantyEndDate, today)
          const isExpiringSoon = daysLeft <= 30 && daysLeft > 0
          const isExpired = daysLeft <= 0

          return (
            <div key={as.id} className={cn(
              'bg-card border rounded-xl p-4',
              isExpired ? 'border-red-300 dark:border-red-800' :
              isExpiringSoon ? 'border-amber-300 dark:border-amber-800' : 'border-border'
            )}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={cn('h-5 w-5', isExpired ? 'text-red-500' : isExpiringSoon ? 'text-amber-500' : 'text-green-500')} />
                  <div>
                    <p className="font-medium text-sm">{project?.customerName ?? '-'}</p>
                    <p className="text-xs text-muted-foreground">{project?.name ?? '-'}</p>
                  </div>
                </div>
                {isExpiringSoon && (
                  <div className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Habis {daysLeft} hari lagi
                  </div>
                )}
                {isExpired && (
                  <span className="text-xs text-red-600 font-medium">Garansi Habis</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground mt-2">
                <div>
                  <p className="font-medium text-foreground">{format(as.warrantyStartDate, 'd MMM yyyy', { locale: localeId })}</p>
                  <p>Mulai garansi</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">{format(as.warrantyEndDate, 'd MMM yyyy', { locale: localeId })}</p>
                  <p>Akhir garansi</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">{as.warrantyDurationMonths} bulan</p>
                  <p>Durasi</p>
                </div>
              </div>
            </div>
          )
        })}
        {records.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            Belum ada data garansi
          </div>
        )}
      </div>

      {showForm && <NewWarrantyForm projects={projects} onClose={() => setShowForm(false)} />}
    </div>
  )
}
